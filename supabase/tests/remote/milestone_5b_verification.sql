-- 5B verification: independent fixtures, no existing user data changes, ALL writes rolled back.
begin;
set local statement_timeout = '30s';

do $catalog$
declare
  logger oid := 'public.record_planned_action_execution()'::regprocedure;
  writer oid := 'ai_life_planner_activity_writer'::regrole;
begin
  if (select prosecdef from pg_proc where oid = 'public.update_planned_action_status(uuid,text)'::regprocedure) then
    raise exception '5B: Execution RPC is no longer SECURITY INVOKER';
  end if;
  if not (select prosecdef and proowner = writer from pg_proc where oid = logger)
    or (select proconfig from pg_proc where oid = logger) <> array['search_path=""'] then
    raise exception '5B: unsafe logger owner/search_path/security';
  end if;
  if (select rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb from pg_roles where oid = writer)
    or pg_has_role('authenticated', writer, 'MEMBER') then
    raise exception '5B: writer role is overprivileged';
  end if;
  if position('auth.' in pg_get_functiondef(logger)) > 0 then
    raise exception '5B: snapshot logger still depends on auth namespace';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.activity_logs'::regclass)
    or not has_table_privilege('authenticated', 'public.activity_logs', 'SELECT')
    or has_table_privilege('anon', 'public.activity_logs', 'SELECT')
    or has_table_privilege('authenticated', 'public.activity_logs', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role', 'public.activity_logs', 'INSERT,UPDATE,DELETE')
    or has_function_privilege('authenticated', logger, 'EXECUTE')
    or has_function_privilege('anon', logger, 'EXECUTE')
    or has_table_privilege(writer, 'public.activity_logs', 'SELECT,UPDATE,DELETE')
    or has_schema_privilege(writer, 'public', 'CREATE') then
    raise exception '5B: unexpected grants';
  end if;
end;
$catalog$;

insert into auth.users(id, email) values
  ('81000000-0000-4000-8000-000000000001', 'm5b-owner@example.invalid'),
  ('81000000-0000-4000-8000-000000000002', 'm5b-other@example.invalid');
insert into public.tasks(id, user_id, title, estimated_minutes, priority, status)
select ('82000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  case when n = 6 then '81000000-0000-4000-8000-000000000002'::uuid else '81000000-0000-4000-8000-000000000001'::uuid end,
  '5B Task ' || n, 30, 'high', 'pending'
from generate_series(1,6) n;
insert into public.daily_plans(id, user_id, plan_date, timezone) values
  ('83000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Tokyo')::date, 'Asia/Tokyo'),
  ('83000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Tokyo')::date, 'Asia/Tokyo'),
  ('83000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Tokyo')::date - 1, 'Asia/Tokyo');
insert into public.planned_actions(id, user_id, daily_plan_id, task_id, title, start_at, end_at, status)
select ('84000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  case when n = 7 then '81000000-0000-4000-8000-000000000002'::uuid else '81000000-0000-4000-8000-000000000001'::uuid end,
  case when n = 7 then '83000000-0000-4000-8000-000000000002'::uuid
    when n = 10 then '83000000-0000-4000-8000-000000000003'::uuid else '83000000-0000-4000-8000-000000000001'::uuid end,
  case n when 1 then '82000000-0000-4000-8000-000000000001'::uuid
    when 2 then '82000000-0000-4000-8000-000000000002'::uuid
    when 5 then '82000000-0000-4000-8000-000000000003'::uuid
    when 6 then '82000000-0000-4000-8000-000000000004'::uuid
    when 7 then '82000000-0000-4000-8000-000000000006'::uuid else null end,
  '5B Action ' || n, now() - interval '2 hours', now() - interval '90 minutes',
  case when n = 8 then 'completed' else 'scheduled' end
from generate_series(1,10) n;

create function public.m5b_fail_task_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id = '82000000-0000-4000-8000-000000000003'::uuid then
    raise exception '5B injected Task failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger m5b_fail_task_update before update on public.tasks
for each row execute function public.m5b_fail_task_update();
create function public.m5b_fail_log_insert() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.planned_action_id in ('84000000-0000-4000-8000-000000000006'::uuid, '84000000-0000-4000-8000-000000000009'::uuid) then
    raise exception '5B injected Log failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger m5b_fail_log_insert before insert on public.activity_logs
for each row execute function public.m5b_fail_log_insert();

select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $execution$
declare
  log_row public.activity_logs%rowtype;
  snapshot jsonb;
  target text;
  started_at timestamptz := clock_timestamp();
  read_log record;
  previous_occurred_at timestamptz;
  previous_id uuid;
  read_count integer := 0;
  complete_count integer := 0;
  skip_count integer := 0;
  null_task_count integer := 0;
begin
  if (select count(*) from public.activity_logs) <> 0 then raise exception '5B: backfill/INSERT created fake history'; end if;
  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000008','completed');
  if (select count(*) from public.activity_logs) <> 0 then raise exception '5B: preexisting final status was backfilled'; end if;

  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000001','completed');
  select * into strict log_row from public.activity_logs;
  if log_row.user_id <> '81000000-0000-4000-8000-000000000001'::uuid
    or log_row.event_type <> 'planned_action_completed'
    or log_row.planned_action_id <> '84000000-0000-4000-8000-000000000001'::uuid
    or log_row.task_id <> '82000000-0000-4000-8000-000000000001'::uuid
    or log_row.action_title <> '5B Action 1' or log_row.timezone <> 'Asia/Tokyo'
    or log_row.plan_date <> (now() at time zone 'Asia/Tokyo')::date
    or log_row.scheduled_start_at <> now() - interval '2 hours'
    or log_row.scheduled_end_at <> now() - interval '90 minutes'
    or log_row.occurred_at < started_at or log_row.occurred_at > clock_timestamp()
    or (select status from public.tasks where id = log_row.task_id) <> 'completed'
    or (select status from public.planned_actions where id = log_row.planned_action_id) <> 'completed' then
    raise exception '5B: Complete snapshot/state incorrect';
  end if;
  snapshot := to_jsonb(log_row);
  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000002','skipped');
  if not exists(select 1 from public.activity_logs where event_type = 'planned_action_skipped' and task_id = '82000000-0000-4000-8000-000000000002')
    or (select status from public.tasks where id = '82000000-0000-4000-8000-000000000002') <> 'pending' then
    raise exception '5B: Skip history/Task incorrect';
  end if;
  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000003','completed');
  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000004','skipped');
  if (select count(*) from public.activity_logs where task_id is null) <> 2 then raise exception '5B: null Task history incorrect'; end if;
  -- Execute the ActivityLogRepository SELECT shape against real fixture rows,
  -- using the current profile-local Today date (the fixture profile is Tokyo).
  for read_log in
    select id, user_id, event_type, occurred_at, planned_action_id, task_id,
      plan_date, timezone, action_title, scheduled_start_at, scheduled_end_at
    from public.activity_logs
    where user_id = auth.uid() and plan_date = (now() at time zone 'Asia/Tokyo')::date
    order by occurred_at desc, id desc
  loop
    if read_log.user_id <> auth.uid() or read_log.timezone <> 'Asia/Tokyo'
      or length(btrim(read_log.action_title)) = 0
      or read_log.scheduled_start_at >= read_log.scheduled_end_at then
      raise exception '5B: Today snapshot read incorrect';
    end if;
    if previous_occurred_at is not null and (
      previous_occurred_at < read_log.occurred_at or
      (previous_occurred_at = read_log.occurred_at and previous_id < read_log.id)
    ) then
      raise exception '5B: Today query ordering incorrect';
    end if;
    previous_occurred_at := read_log.occurred_at;
    previous_id := read_log.id;
    read_count := read_count + 1;
    if read_log.event_type = 'planned_action_completed' then complete_count := complete_count + 1; end if;
    if read_log.event_type = 'planned_action_skipped' then skip_count := skip_count + 1; end if;
    if read_log.task_id is null then null_task_count := null_task_count + 1; end if;
  end loop;
  if read_count <> 4 or complete_count <> 2 or skip_count <> 2 or null_task_count <> 2 then
    raise exception '5B: Today query result coverage incorrect';
  end if;
  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000001','completed');
  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000002','skipped');
  begin
    update public.planned_actions set status = status where id = '84000000-0000-4000-8000-000000000001';
    raise exception '5B: direct status UPDATE allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.planned_actions set reason = 'Unrelated metadata' where id = '84000000-0000-4000-8000-000000000001';
    raise exception '5B: direct reason UPDATE allowed';
  exception when insufficient_privilege then null; end;
  update public.tasks set status = 'completed' where id = '82000000-0000-4000-8000-000000000005';
  if (select count(*) from public.activity_logs) <> 4 then raise exception '5B: no-op/metadata/Task update created Log'; end if;

  begin
    update public.planned_actions set status = 'completed', title = 'Forged execution context'
    where id = '84000000-0000-4000-8000-000000000009';
    raise exception '5B: simultaneous context rewrite accepted';
  exception when invalid_parameter_value or insufficient_privilege then null; end;

  foreach target in array array['skipped','scheduled'] loop
    begin
      perform public.update_planned_action_status('84000000-0000-4000-8000-000000000001',target);
      raise exception '5B: completed transition accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  foreach target in array array['completed','scheduled'] loop
    begin
      perform public.update_planned_action_status('84000000-0000-4000-8000-000000000002',target);
      raise exception '5B: skipped transition accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  begin
    perform public.update_planned_action_status('84000000-0000-4000-8000-000000000007','completed');
    raise exception '5B: other owner accepted';
  exception when no_data_found then null; end;
  begin
    perform public.update_planned_action_status('84000000-0000-4000-8000-000000000005','completed');
    raise exception '5B: Task failure missing';
  exception when check_violation then null; end;
  begin
    perform public.update_planned_action_status('84000000-0000-4000-8000-000000000006','completed');
    raise exception '5B: Complete Log failure missing';
  exception when check_violation then null; end;
  begin
    perform public.update_planned_action_status('84000000-0000-4000-8000-000000000009','skipped');
    raise exception '5B: Skip Log failure missing';
  exception when check_violation then null; end;
  if (select count(*) from public.activity_logs) <> 4
    or exists(select 1 from public.planned_actions where id in ('84000000-0000-4000-8000-000000000005','84000000-0000-4000-8000-000000000006','84000000-0000-4000-8000-000000000009') and status <> 'scheduled')
    or exists(select 1 from public.tasks where id in ('82000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000004') and status <> 'pending') then
    raise exception '5B: partial state after rejected/failed transaction';
  end if;

  begin
    insert into public.activity_logs select * from public.activity_logs limit 1;
    raise exception '5B: direct INSERT allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.activity_logs set action_title = 'Forged';
    raise exception '5B: direct UPDATE allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.activity_logs;
    raise exception '5B: direct DELETE allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_planned_action_execution();
    raise exception '5B: logger directly executable';
  exception when insufficient_privilege then null; end;

  -- Historical snapshots and IDs stay immutable after Action/Task/Plan deletion or replacement.
  delete from public.planned_actions where id = '84000000-0000-4000-8000-000000000001';
  delete from public.tasks where id in ('82000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002');
  perform public.replace_daily_plan((now() at time zone 'Asia/Tokyo')::date,'Asia/Tokyo','5B replaced','[]'::jsonb);
  delete from public.daily_plans where id = '83000000-0000-4000-8000-000000000001';
  update public.profiles set timezone = 'UTC' where id = auth.uid();
  if (select count(*) from public.activity_logs) <> 4
    or (select to_jsonb(log) from public.activity_logs log where id = log_row.id) is distinct from snapshot then
    raise exception '5B: deletion/replacement/settings mutated history';
  end if;
  if not exists(select 1 from public.activity_logs
    where planned_action_id = '84000000-0000-4000-8000-000000000002'
      and task_id = '82000000-0000-4000-8000-000000000002'
      and action_title = '5B Action 2') then
    raise exception '5B: Task deletion rewrote the immutable history reference';
  end if;

  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000010','completed');
  if not exists(select 1 from public.activity_logs where planned_action_id = '84000000-0000-4000-8000-000000000010'
    and plan_date = (now() at time zone 'Asia/Tokyo')::date - 1
    and (occurred_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date
    and timezone = 'Asia/Tokyo') then
    raise exception '5B: late execution changed Plan date or timezone';
  end if;
end;
$execution$;

reset role;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $other_owner$
begin
  if (select count(*) from public.activity_logs) <> 0 then raise exception '5B: other-owner Logs visible'; end if;
  perform public.update_planned_action_status('84000000-0000-4000-8000-000000000007','skipped');
  if (select count(*) from public.activity_logs) <> 1
    or exists(select 1 from public.activity_logs where user_id <> auth.uid()) then raise exception '5B: own SELECT scope incorrect'; end if;
end;
$other_owner$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
do $no_identity$
begin
  if exists(select 1 from public.activity_logs) then raise exception '5B: missing identity can read Logs'; end if;
end;
$no_identity$;
reset role;
set local role anon;
do $anon$
begin
  begin
    perform 1 from public.activity_logs;
    raise exception '5B: anon SELECT allowed';
  exception when insufficient_privilege then null; end;
end;
$anon$;
reset role;
rollback;
