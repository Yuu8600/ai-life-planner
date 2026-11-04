-- Run only after the permission fix migration. All fixtures roll back.
begin;
set local statement_timeout = '30s';
do $catalog$
declare
  logger oid := 'public.record_planned_action_execution()'::regprocedure;
  executor oid := 'ai_life_planner_execution_writer'::regrole;
begin
  if has_schema_privilege('ai_life_planner_activity_writer','auth','USAGE')
    or has_schema_privilege(executor,'auth','USAGE') then
    raise exception 'Fix verification requires writers WITHOUT auth namespace USAGE';
  end if;
  if position('auth.' in pg_get_functiondef(logger)) > 0
    or exists(select 1 from pg_policies where policyname in ('daily_plans_activity_writer_select','activity_logs_writer_insert')
      and (coalesce(qual,'') || coalesce(with_check,'')) like '%auth.%') then
    raise exception 'Logger still has an explicit or policy auth dependency';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.update_planned_action_status(uuid,text)'::regprocedure)
    or position('auth.uid()' in pg_get_functiondef('public.update_planned_action_status(uuid,text)'::regprocedure)) = 0 then
    raise exception 'Public RPC authentication/INVOKER boundary changed';
  end if;
  if position('for update' in lower(pg_get_functiondef('public.update_planned_action_status(uuid,text)'::regprocedure))) > 0
    or position('for update' in lower(pg_get_functiondef('planner_execution_private.apply_transition(uuid,text)'::regprocedure))) = 0 then
    raise exception 'Row locks must be held only by the private execution capability';
  end if;
  if not (select prosecdef and proowner = executor and proconfig = array['search_path=""']
    from pg_proc where oid = 'planner_execution_private.apply_transition(uuid,text)'::regprocedure)
    or (select rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb from pg_roles where oid = executor)
    or pg_has_role('authenticated',executor,'MEMBER') then
    raise exception 'Unsafe execution capability';
  end if;
  if not (select not prosecdef and prosqlbody is not null
    from pg_proc where oid = 'planner_execution_private.actor_id()'::regprocedure) then
    raise exception 'Identity adapter must be pre-bound SQL-standard INVOKER';
  end if;
  if has_table_privilege('authenticated','public.planned_actions','UPDATE')
    or has_column_privilege('authenticated','public.planned_actions','status','UPDATE')
    or has_column_privilege('authenticated','public.planned_actions','title','UPDATE')
    or has_any_column_privilege('authenticated','public.planned_actions','UPDATE')
    or has_column_privilege('anon','public.planned_actions','status','UPDATE') then
    raise exception 'Client still has an Action table/column UPDATE grant';
  end if;
  if has_function_privilege('authenticated','planner_execution_private.actor_id()','EXECUTE')
    or has_function_privilege('anon','planner_execution_private.apply_transition(uuid,text)','EXECUTE')
    or has_schema_privilege(executor,'planner_execution_private','CREATE') then
    raise exception 'Private capability is overexposed';
  end if;
end;
$catalog$;

insert into auth.users(id,email) values
 ('91000000-0000-4000-8000-000000000001','m5b-fix-owner@example.invalid'),
 ('91000000-0000-4000-8000-000000000002','m5b-fix-other@example.invalid');
insert into public.tasks(id,user_id,title,estimated_minutes,priority,status)
select ('92000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 case when n = 4 then '91000000-0000-4000-8000-000000000002'::uuid else '91000000-0000-4000-8000-000000000001'::uuid end,
 'Permission fixture ' || n,30,'high','pending' from generate_series(1,4) n;
insert into public.daily_plans(id,user_id,plan_date,timezone) values
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Tokyo')::date,'Asia/Tokyo'),
 ('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002',(now() at time zone 'Asia/Tokyo')::date,'Asia/Tokyo');
insert into public.planned_actions(id,user_id,daily_plan_id,task_id,title,start_at,end_at)
select ('94000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 case when n = 5 then '91000000-0000-4000-8000-000000000002'::uuid else '91000000-0000-4000-8000-000000000001'::uuid end,
 case when n = 5 then '93000000-0000-4000-8000-000000000002'::uuid else '93000000-0000-4000-8000-000000000001'::uuid end,
 case n when 1 then '92000000-0000-4000-8000-000000000001'::uuid
   when 2 then '92000000-0000-4000-8000-000000000002'::uuid
   when 5 then '92000000-0000-4000-8000-000000000004'::uuid
   when 6 then '92000000-0000-4000-8000-000000000003'::uuid else null end,
 'Action permission fixture ' || n,now() - interval '2 hours',now() - interval '1 hour'
from generate_series(1,6) n;

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
set local role ai_life_planner_execution_writer;
do $identity$
begin
  if planner_execution_private.actor_id() <> '91000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Pre-bound actor lookup lost the request identity';
  end if;
  begin
    perform auth.uid();
    raise exception 'Test did not reproduce the missing auth namespace access';
  exception when insufficient_privilege then null; end;
end;
$identity$;
reset role;
set local role authenticated;
do $execution$
declare
  target text;
  result record;
begin
  foreach target in array array['completed','skipped','scheduled'] loop
    begin
      update public.planned_actions set status = target where id = '94000000-0000-4000-8000-000000000001';
      raise exception 'Direct status UPDATE bypass allowed';
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    update public.planned_actions set reason = 'Direct client reason write'
    where id = '94000000-0000-4000-8000-000000000001';
    raise exception 'Direct reason UPDATE allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.planned_actions(id,user_id,daily_plan_id,title,start_at,end_at,status)
    values('94000000-0000-4000-8000-000000000007',auth.uid(),'93000000-0000-4000-8000-000000000001','Forged terminal',now(),now()+interval '1 hour','completed');
    raise exception 'Direct terminal INSERT bypass allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.planned_actions(id,user_id,daily_plan_id,title,start_at,end_at)
    values('94000000-0000-4000-8000-000000000001',auth.uid(),'93000000-0000-4000-8000-000000000001','Upsert bypass',now(),now()+interval '1 hour')
    on conflict(id) do update set status = 'completed';
    raise exception 'Upsert status bypass allowed';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.activity_logs) then raise exception 'Bypass attempts created history'; end if;

  perform public.update_planned_action_status('94000000-0000-4000-8000-000000000001','completed');
  perform public.update_planned_action_status('94000000-0000-4000-8000-000000000002','skipped');
  perform public.update_planned_action_status('94000000-0000-4000-8000-000000000003','completed');
  perform public.update_planned_action_status('94000000-0000-4000-8000-000000000004','skipped');
  if (select count(*) from public.activity_logs) <> 4
    or (select status from public.tasks where id = '92000000-0000-4000-8000-000000000001') <> 'completed'
    or (select status from public.tasks where id = '92000000-0000-4000-8000-000000000002') <> 'pending' then
    raise exception 'RPC regression under status column restriction';
  end if;
  perform public.update_planned_action_status('94000000-0000-4000-8000-000000000001','completed');
  perform public.update_planned_action_status('94000000-0000-4000-8000-000000000002','skipped');
  if (select count(*) from public.activity_logs) <> 4 then raise exception 'Replay created history'; end if;
  begin
    perform public.update_planned_action_status('94000000-0000-4000-8000-000000000005','completed');
    raise exception 'Other owner public RPC accepted';
  exception when no_data_found then null; end;
  begin
    perform planner_execution_private.apply_transition('94000000-0000-4000-8000-000000000005','completed');
    raise exception 'Other owner private capability accepted';
  exception when no_data_found then null; end;
  -- The non-exposed helper is NOT a raw Action-update escape hatch: it performs
  -- the complete authenticated Action+Task+Log operation even if called directly.
  perform planner_execution_private.apply_transition('94000000-0000-4000-8000-000000000006','completed');
  if (select status from public.tasks where id = '92000000-0000-4000-8000-000000000003') <> 'completed'
    or (select count(*) from public.activity_logs) <> 5 then
    raise exception 'Private capability bypassed atomic Task/Log completion';
  end if;
  perform planner_execution_private.apply_transition('94000000-0000-4000-8000-000000000006','completed');
  foreach target in array array['skipped','scheduled'] loop
    begin
      perform planner_execution_private.apply_transition('94000000-0000-4000-8000-000000000006',target);
      raise exception 'Private capability bypassed final-transition restrictions';
    exception when invalid_parameter_value then null; end;
  end loop;
  if (select count(*) from public.activity_logs) <> 5 then raise exception 'Private replay/rejection created history'; end if;
  begin
    update public.planned_actions set reason = 'Direct final-action metadata write'
    where id = '94000000-0000-4000-8000-000000000001';
    raise exception 'Direct final Action reason UPDATE allowed';
  exception when insufficient_privilege then null; end;
  select * into result from public.replace_daily_plan((now() at time zone 'Asia/Tokyo')::date,'Asia/Tokyo','Permission regression',jsonb_build_array(jsonb_build_object(
    'task_id',null,'title','Replacement fixture','start_at',now(),'end_at',now()+interval '30 minutes','reason','Regression'
  )));
  if result.saved_action_count <> 1 or (select count(*) from public.planned_actions) <> 1
    or (select count(*) from public.activity_logs) <> 5 then
    raise exception 'Plan replacement / history retention regression';
  end if;
end;
$execution$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $no_identity$
begin
  begin
    perform planner_execution_private.apply_transition('94000000-0000-4000-8000-000000000005','completed');
    raise exception 'Private capability accepted a missing identity';
  exception when insufficient_privilege then null; end;
  begin
    perform planner_execution_private.actor_id();
    raise exception 'Client directly executed the identity adapter';
  exception when insufficient_privilege then null; end;
end;
$no_identity$;
reset role;
set local role anon;
do $anon$
begin
  begin
    perform public.update_planned_action_status('94000000-0000-4000-8000-000000000005','completed');
    raise exception 'Anon public RPC accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform planner_execution_private.apply_transition('94000000-0000-4000-8000-000000000005','completed');
    raise exception 'Anon private capability accepted';
  exception when insufficient_privilege then null; end;
end;
$anon$;
reset role;
rollback;
