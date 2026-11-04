-- Transactional fixture-only verification. Safe to run remotely AFTER approval/application.
begin;
set local statement_timeout = '30s';
do $catalog$
begin
  if has_any_column_privilege('authenticated','public.planned_actions','UPDATE')
    or has_schema_privilege('ai_life_planner_execution_writer','auth','USAGE')
    or has_function_privilege('anon','public.replace_daily_plan_if_current(date,text,text,jsonb,jsonb)','EXECUTE')
    or (select prosecdef from pg_proc where oid = 'public.replace_daily_plan_if_current(date,text,text,jsonb,jsonb)'::regprocedure)
    or not (select prosecdef and proowner = 'ai_life_planner_execution_writer'::regrole
      and proconfig = array['search_path=""'] from pg_proc
      where oid = 'planner_execution_private.lock_replan_if_current(date,jsonb,jsonb)'::regprocedure)
    or pg_has_role('authenticated','ai_life_planner_execution_writer','MEMBER') then
    raise exception '5C security boundary regression';
  end if;
end;
$catalog$;

insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','m5c-owner@example.invalid'),
 ('a1000000-0000-4000-8000-000000000002','m5c-other@example.invalid');
insert into public.tasks(id,user_id,title,estimated_minutes,priority,status)
select ('a2000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 case when n=4 then 'a1000000-0000-4000-8000-000000000002'::uuid else 'a1000000-0000-4000-8000-000000000001'::uuid end,
 'Replan fixture',30,'high','pending' from generate_series(1,4) n;
insert into public.daily_plans(id,user_id,plan_date,timezone,summary) values
 ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Tokyo')::date,'Asia/Tokyo','Old Plan');
insert into public.planned_actions(id,user_id,daily_plan_id,task_id,title,start_at,end_at)
select ('a4000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',
 case when n=1 then 'a2000000-0000-4000-8000-000000000001'::uuid else null end,
 'Old Action',now()-interval '2 hours',now()-interval '1 hour' from generate_series(1,3) n;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select * from public.update_planned_action_status('a4000000-0000-4000-8000-000000000002','completed');
select * from public.update_planned_action_status('a4000000-0000-4000-8000-000000000003','skipped');

do $cases$
declare
  day date := (now() at time zone 'Asia/Tokyo')::date;
  expected jsonb := public.get_daily_plan_snapshot(day);
  before_save jsonb;
  logs_before integer;
  kind text;
  status_value text;
  task_states jsonb;
  result record;
  actions jsonb := jsonb_build_array(jsonb_build_object(
    'task_id','a2000000-0000-4000-8000-000000000001','title','New Action',
    'start_at',clock_timestamp()+interval '1 hour','end_at',clock_timestamp()+interval '90 minutes','reason','Fixture'));
begin
  if jsonb_array_length(expected->'actions') <> 3 or (select count(*) from public.activity_logs) <> 2 then
    raise exception '5C initial snapshot/history incorrect';
  end if;
  foreach kind in array array['complete','skip','replace','task-completed','task-scheduled','task-skipped','task-deleted','task-other-owner','plan-deleted','past-start'] loop
    begin
      if kind='complete' then perform public.update_planned_action_status('a4000000-0000-4000-8000-000000000001','completed');
      elsif kind='skip' then perform public.update_planned_action_status('a4000000-0000-4000-8000-000000000001','skipped');
      elsif kind='replace' then perform public.replace_daily_plan(day,'Asia/Tokyo','Another Plan','[]');
      elsif kind like 'task-%' and kind not in ('task-deleted','task-other-owner') then
        status_value := substring(kind from 6);
        update public.tasks set status=status_value where id='a2000000-0000-4000-8000-000000000001';
      elsif kind='task-deleted' then delete from public.tasks where id='a2000000-0000-4000-8000-000000000001';
      elsif kind='plan-deleted' then delete from public.daily_plans where id='a3000000-0000-4000-8000-000000000001';
      end if;
      before_save := public.get_daily_plan_snapshot(day);
      select count(*) into logs_before from public.activity_logs;
      begin
        perform public.replace_daily_plan_if_current(day,'Asia/Tokyo','Rejected Plan',
          case when kind='task-other-owner' then jsonb_set(actions,'{0,task_id}','"a2000000-0000-4000-8000-000000000004"')
            when kind='past-start' then jsonb_set(actions,'{0,start_at}',to_jsonb(clock_timestamp()-interval '1 minute')) else actions end,
          expected);
        raise exception '5C accepted stale case %',kind;
      exception when sqlstate 'P5C01' then null; end;
      if public.get_daily_plan_snapshot(day) is distinct from before_save
        or (select count(*) from public.activity_logs) <> logs_before then raise exception '5C stale partial state %',kind; end if;
      raise exception using errcode='ZX001',message='Rollback this case only';
    exception when sqlstate 'ZX001' then null; end;
  end loop;

  -- An insert failure AFTER deletion must restore the entire old Plan and history.
  select jsonb_agg(to_jsonb(task) order by task.id) into task_states from public.tasks as task;
  begin
    perform public.replace_daily_plan_if_current(day,'Asia/Tokyo','Must rollback',actions || jsonb_set(actions,'{0,title}','" "'),expected);
    raise exception '5C failed to reject invalid insert';
  exception when check_violation then null; end;
  if public.get_daily_plan_snapshot(day) is distinct from expected or (select count(*) from public.activity_logs) <> 2
    or (select jsonb_agg(to_jsonb(task) order by task.id) from public.tasks as task) is distinct from task_states then
    raise exception '5C insert failure left partial state';
  end if;

  update public.tasks set status='completed' where id='a2000000-0000-4000-8000-000000000002';
  select * into result from public.replace_daily_plan_if_current(day,'Asia/Tokyo','New Plan',actions,expected);
  if result.daily_plan_id <> 'a3000000-0000-4000-8000-000000000001'::uuid or result.saved_action_count <> 1
    or (select summary from public.daily_plans where id=result.daily_plan_id) <> 'New Plan'
    or (select count(*) from public.planned_actions) <> 1 or (select count(*) from public.activity_logs) <> 2
    or (select status from public.tasks where id='a2000000-0000-4000-8000-000000000001') <> 'pending'
    or exists(select 1 from public.planned_actions where id in (
      'a4000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000003')) then
    raise exception '5C replacement / unrelated Task / history / no-carry regression';
  end if;
  -- Same owner/date/Plan/time-bound reads used by Today, with retained snapshot history.
  if (select count(*) from public.daily_plans where user_id=auth.uid() and plan_date=day) <> 1
    or (select count(*) from public.planned_actions where user_id=auth.uid() and daily_plan_id=result.daily_plan_id
      and start_at >= (day::timestamp at time zone 'Asia/Tokyo')
      and start_at < ((day+1)::timestamp at time zone 'Asia/Tokyo')) <> (case
        when (actions->0->>'start_at')::timestamptz < ((day+1)::timestamp at time zone 'Asia/Tokyo') then 1 else 0 end)
    or (select count(*) from public.activity_logs where user_id=auth.uid() and plan_date=day) <> 2 then
    raise exception '5C Today scoped refresh query regression';
  end if;
  expected := public.get_daily_plan_snapshot(day);
  -- Null-Task Actions are accepted in the new Proposal, but never copied from old Actions.
  perform public.replace_daily_plan_if_current(day,'Asia/Tokyo','Free',jsonb_set(actions,'{0,task_id}','null'),expected);
  if exists(select 1 from public.planned_actions where task_id is not null) then raise exception '5C null Task rejected'; end if;
  expected := public.get_daily_plan_snapshot(day);
  perform public.replace_daily_plan_if_current(day,'Asia/Tokyo','Empty','[]',expected);
  expected := public.get_daily_plan_snapshot(day);
  if jsonb_array_length(expected->'actions') <> 0 then raise exception '5C empty replace failed'; end if;
  perform public.replace_daily_plan(day,'Asia/Tokyo','Another empty Plan','[]');
  begin
    perform public.replace_daily_plan_if_current(day,'Asia/Tokyo','Stale empty','[]',expected);
    raise exception '5C empty Plan change missed';
  exception when sqlstate 'P5C01' then null; end;
end;
$cases$;

reset role;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $ownership$
declare day date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if public.get_daily_plan_snapshot(day) is not null then raise exception '5C other Plan visible'; end if;
  begin
    perform public.replace_daily_plan_if_current(day,'Asia/Tokyo','Other','[]','{"id":"a3000000-0000-4000-8000-000000000001"}');
    raise exception '5C other-owner replacement allowed';
  exception when sqlstate 'P5C01' then null; end;
end;
$ownership$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $no_auth$
begin
  begin
    perform public.replace_daily_plan_if_current(current_date,'Asia/Tokyo','No auth','[]','{}');
    raise exception '5C missing auth allowed';
  exception when insufficient_privilege then null; end;
end;
$no_auth$;
reset role;
rollback;
