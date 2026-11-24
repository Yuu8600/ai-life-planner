begin;
do $$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 18
    or not exists (select 1 from public.activity_logs where planned_action_id='fe280005-0000-4000-8000-000000000001')
    or not exists (select 1 from public.tasks where id='fe280003-0000-4000-8000-000000000001'
      and recurrence='once' and recurrence_days='{}' and deadline_local is null)
    or to_regclass('public.v2_threads') is null
    or to_regprocedure('public.v27_approve_calendar_policies(uuid,uuid,jsonb)') is null then
    raise exception 'Migration set, legacy state or AI schema mismatch';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','fe280001-0000-4000-8000-000000000002',true);
do $$
begin
  if exists (select 1 from public.tasks where id='fe280003-0000-4000-8000-000000000001')
    or exists (select 1 from public.goals where id='fe280002-0000-4000-8000-000000000001')
    or exists (select 1 from public.activity_logs where planned_action_id='fe280005-0000-4000-8000-000000000001')
    or exists (select 1 from public.daily_plans where id='fe280004-0000-4000-8000-000000000001')
    or exists (select 1 from public.planned_actions where id='fe280005-0000-4000-8000-000000000001') then
    raise exception 'Another user can read legacy data';
  end if;
end $$;

select set_config('request.jwt.claim.sub','fe280001-0000-4000-8000-000000000001',true);
insert into public.tasks(user_id,title,estimated_minutes,priority,status) values
 ('fe280001-0000-4000-8000-000000000001','No duration after migration',null,'medium','pending');
do $$
begin
  if not exists (select 1 from public.tasks where title='No duration after migration' and estimated_minutes is null) then
    raise exception 'Nullable estimate was not saved';
  end if;
  begin
    insert into public.tasks(user_id,title,estimated_minutes,priority,status) values
      ('fe280001-0000-4000-8000-000000000001','Invalid numeric estimate',0,'medium','pending');
    raise exception 'Invalid numeric estimate was accepted';
  exception when check_violation then null;
  end;
end $$;
-- Exercise the current AI storage and budget lifecycle without invoking OpenAI.
insert into public.v2_threads (title) values ('Rehearsal chat');
reset role;
do $$
declare
  owner_id uuid := 'fe280001-0000-4000-8000-000000000001';
  thread_id uuid := (select id from public.v2_threads where user_id=owner_id and title='Rehearsal chat');
  request_id uuid := gen_random_uuid();
begin
  if not public.v2_reserve_ai(request_id,owner_id,thread_id,'mock',400000,'test') then
    raise exception 'AI usage could not be reserved';
  end if;
  perform public.v2_finish_ai(request_id,owner_id,thread_id,'Mock reply',
    '[{"key":"t","kind":"task","title":"AI rehearsal task","priority":"high","goalId":"fe280002-0000-4000-8000-000000000001"}]'::jsonb,
    400000,1,1);
  if public.v2_reserve_ai(gen_random_uuid(),owner_id,thread_id,'mock',100001,'test') then
    raise exception 'AI budget limit accepted an overrun';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','fe280001-0000-4000-8000-000000000002',true);
do $$
begin
  if exists (select 1 from public.v2_threads)
    or exists (select 1 from public.v2_messages)
    or exists (select 1 from public.v2_ai_usage)
    or exists (select 1 from public.v2_drafts) then
    raise exception 'Another user can read the AI conversation';
  end if;
end $$;

select set_config('request.jwt.claim.sub','fe280001-0000-4000-8000-000000000001',true);
do $$
declare draft public.v2_drafts%rowtype;
begin
  select * into strict draft from public.v2_drafts;
  if exists (select 1 from public.tasks where title='AI rehearsal task') then
    raise exception 'AI wrote a task before approval';
  end if;
  if not public.v2_approve_draft(draft.id,draft.revision,array['t']) then
    raise exception 'The current draft could not be approved';
  end if;
  if not exists (select 1 from public.tasks where title='AI rehearsal task'
    and goal_id='fe280002-0000-4000-8000-000000000001' and estimated_minutes is null) then
    raise exception 'The approved AI task did not retain its Goal and missing estimate';
  end if;
end $$;
rollback;
