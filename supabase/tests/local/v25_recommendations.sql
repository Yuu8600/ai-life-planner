begin;

insert into auth.users (id, email) values
  ('fe250000-0000-4000-8000-000000000001', 'v25-a@example.test'),
  ('fe250000-0000-4000-8000-000000000002', 'v25-b@example.test');
update public.profiles set timezone = 'Asia/Tokyo'
where id in ('fe250000-0000-4000-8000-000000000001', 'fe250000-0000-4000-8000-000000000002');

insert into public.tasks(id, user_id, title, estimated_minutes, recurrence, priority, status) values
  ('fe250001-0000-4000-8000-000000000001', 'fe250000-0000-4000-8000-000000000001', 'Quick add', null, 'once', 'medium', 'pending'),
  ('fe250001-0000-4000-8000-000000000002', 'fe250000-0000-4000-8000-000000000001', 'Daily', 30, 'daily', 'medium', 'pending'),
  ('fe250001-0000-4000-8000-000000000003', 'fe250000-0000-4000-8000-000000000002', 'Other user', 15, 'once', 'medium', 'pending'),
  ('fe250001-0000-4000-8000-000000000004', 'fe250000-0000-4000-8000-000000000001', 'Parent', null, 'once', 'medium', 'pending');
insert into public.action_steps(id, user_id, task_id, title, repeatable) values
  ('fe250002-0000-4000-8000-000000000001', 'fe250000-0000-4000-8000-000000000001', 'fe250001-0000-4000-8000-000000000004', 'Step once', false),
  ('fe250002-0000-4000-8000-000000000002', 'fe250000-0000-4000-8000-000000000001', 'fe250001-0000-4000-8000-000000000004', 'Step reusable', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'fe250000-0000-4000-8000-000000000001', true);

do $$
declare
  day date := (statement_timestamp() at time zone 'Asia/Tokyo')::date;
  one uuid := 'fe250001-0000-4000-8000-000000000001';
  recurring uuid := 'fe250001-0000-4000-8000-000000000002';
  other uuid := 'fe250001-0000-4000-8000-000000000003';
  parent uuid := 'fe250001-0000-4000-8000-000000000004';
  step uuid := 'fe250002-0000-4000-8000-000000000001';
  reusable uuid := 'fe250002-0000-4000-8000-000000000002';
begin
  insert into public.action_steps(task_id, title) values (parent, 'From authenticated app');
  if public.record_recommendation_result(day, 'task', one, 'completed') <> 'completed' then
    raise exception 'Task completion returned wrong outcome';
  end if;
  if public.record_recommendation_result(day, 'task', one, 'skipped') <> 'completed' then
    raise exception 'Retry returned wrong outcome';
  end if;
  if (select status from public.tasks where id = one) <> 'completed' then
    raise exception 'Single task did not complete';
  end if;
  perform public.record_recommendation_result(day, 'task', recurring, 'completed');
  perform public.record_recommendation_result(day, 'step', step, 'completed');
  perform public.record_recommendation_result(day, 'step', reusable, 'completed');
  perform public.record_recommendation_result(day, 'task', parent, 'skipped');
  if exists (select from public.tasks where id in (recurring, parent) and status <> 'pending')
    or (select completed_at from public.action_steps where id = step) is null
    or (select completed_at from public.action_steps where id = reusable) is not null
    or (select count(*) from public.recommendation_results where local_date = day) <> 5 then
    raise exception 'Completion semantics or history incorrect';
  end if;

  begin
    perform public.record_recommendation_result(day, 'task', other, 'completed');
    raise exception 'Foreign task accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.action_steps(task_id, title) values (other, 'Foreign task');
    raise exception 'Foreign Step parent accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.action_steps set completed_at = now() where id = reusable;
    raise exception 'Direct completion write accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.recommendation_results;
    raise exception 'Direct history delete accepted';
  exception when insufficient_privilege then null;
  end;
  delete from public.action_steps where id = step;
  if not exists (select from public.recommendation_results where target_id = step) then
    raise exception 'History lost after deleting a Step';
  end if;
end $$;

select set_config('request.jwt.claim.sub', 'fe250000-0000-4000-8000-000000000002', true);
do $$ begin
  if exists (select from public.action_steps) or exists (select from public.recommendation_results) then
    raise exception 'Cross-user read allowed';
  end if;
end $$;
set local role anon;
do $$ begin
  if has_function_privilege(current_user,
    'public.record_recommendation_result(date,text,uuid,text)', 'EXECUTE')
    or has_table_privilege(current_user, 'public.recommendation_results', 'SELECT') then
    raise exception 'Anonymous access granted';
  end if;
end $$;

rollback;
