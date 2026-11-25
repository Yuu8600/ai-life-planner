begin;

insert into auth.users(id, email) values
  ('fe258800-0000-4000-8000-000000000001', 'daily-ux-a@example.test'),
  ('fe258800-0000-4000-8000-000000000002', 'daily-ux-b@example.test');
update public.profiles set timezone = 'Asia/Tokyo'
where id in ('fe258800-0000-4000-8000-000000000001', 'fe258800-0000-4000-8000-000000000002');
insert into public.tasks(id,user_id,title,priority,status,recurrence,recurrence_days) values
  ('fe258801-0000-4000-8000-000000000001','fe258800-0000-4000-8000-000000000001','Scheduled','medium','scheduled','once','{}'),
  ('fe258801-0000-4000-8000-000000000002','fe258800-0000-4000-8000-000000000001','Weekly','medium','pending','weekly','{1,3,5}'),
  ('fe258801-0000-4000-8000-000000000003','fe258800-0000-4000-8000-000000000001','Legacy completed','medium','completed','once','{}');
insert into public.action_steps(id,user_id,task_id,title) values
  ('fe258802-0000-4000-8000-000000000001','fe258800-0000-4000-8000-000000000001','fe258801-0000-4000-8000-000000000001','Step');
insert into public.recommendation_results(user_id,local_date,target_kind,target_id,task_id,title,outcome)
values ('fe258800-0000-4000-8000-000000000001',(now() at time zone 'Asia/Tokyo')::date-1,'task',
  'fe258801-0000-4000-8000-000000000002','fe258801-0000-4000-8000-000000000002','Weekly','completed');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'fe258800-0000-4000-8000-000000000001', true);

do $$
declare
  day date := (statement_timestamp() at time zone 'Asia/Tokyo')::date;
  once_id uuid := 'fe258801-0000-4000-8000-000000000001';
  weekly_id uuid := 'fe258801-0000-4000-8000-000000000002';
  legacy_id uuid := 'fe258801-0000-4000-8000-000000000003';
  step_id uuid := 'fe258802-0000-4000-8000-000000000001';
begin
  perform public.record_recommendation_result(day,'task',once_id,'completed');
  if (select status from public.tasks where id=once_id) <> 'completed' then
    raise exception 'Single task did not complete';
  end if;
  perform public.undo_recommendation_result(day,'task',once_id,'completed');
  perform public.undo_recommendation_result(day,'task',once_id,'completed');
  if (select status from public.tasks where id=once_id) <> 'scheduled' then
    raise exception 'Single task did not return to its prior state';
  end if;
  perform public.record_recommendation_result(day,'task',weekly_id,'completed');
  if (select status from public.tasks where id=weekly_id) <> 'pending' then
    raise exception 'Daily operation changed the recurring task itself';
  end if;
  perform public.undo_recommendation_result(day,'task',weekly_id,'completed');
  perform public.record_recommendation_result(day,'task',weekly_id,'skipped');
  begin
    perform public.undo_recommendation_result(day,'task',weekly_id,'completed');
    raise exception 'Wrong prior outcome was accepted';
  exception when serialization_failure then null;
  end;
  perform public.undo_recommendation_result(day,'task',weekly_id,'skipped');

  perform public.record_recommendation_result(day,'step',step_id,'completed');
  if (select completed_at from public.action_steps where id=step_id) is null then
    raise exception 'Step did not complete';
  end if;
  perform public.undo_recommendation_result(day,'step',step_id,'completed');
  if (select completed_at from public.action_steps where id=step_id) is not null then
    raise exception 'Step cannot be recommended again';
  end if;
  perform public.undo_recommendation_result(day,'task',legacy_id,'reopen');

  perform set_config('request.jwt.claim.sub','fe258800-0000-4000-8000-000000000002',true);
  perform public.undo_recommendation_result(day,'task',once_id,'reopen');
  perform set_config('request.jwt.claim.sub','fe258800-0000-4000-8000-000000000001',true);
  if exists (select from public.recommendation_results where local_date=day)
     or not exists (select from public.recommendation_results where local_date=day-1 and target_id=weekly_id)
     or (select status from public.tasks where id=legacy_id) <> 'pending'
     or (select recurrence_days from public.tasks where id=weekly_id) <> array[1,3,5]::smallint[] then
    raise exception 'Unexpected final task or result state';
  end if;
  begin
    perform public.undo_recommendation_result(day-1,'task',weekly_id,'completed');
    raise exception 'Previous day was modified';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

rollback;
