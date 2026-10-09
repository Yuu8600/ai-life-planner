-- Run only after applying 20261007090000_add_planned_action_execution.sql.
-- All fixtures (including the failure-injection trigger) are rolled back.
begin;
set local statement_timeout = '30s';

do $catalog$
declare
  function_oid oid := to_regprocedure('public.update_planned_action_status(uuid,text)');
begin
  if function_oid is null then raise exception '5A: RPC missing'; end if;
  if (select prosecdef from pg_proc where oid = function_oid) then
    raise exception '5A: RPC must be SECURITY INVOKER';
  end if;
  if (select proconfig from pg_proc where oid = function_oid) <> array['search_path=""'] then
    raise exception '5A: unsafe search_path';
  end if;
  if has_function_privilege('anon', function_oid, 'EXECUTE')
    or not has_function_privilege('authenticated', function_oid, 'EXECUTE') then
    raise exception '5A: unexpected grants';
  end if;
end;
$catalog$;

insert into auth.users (id, email) values
  ('71000000-0000-4000-8000-000000000001', 'm5a-owner@example.invalid'),
  ('71000000-0000-4000-8000-000000000002', 'm5a-other@example.invalid');
insert into public.tasks (id, user_id, title, estimated_minutes, priority, status) values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Complete fixture', 30, 'high', 'pending'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'Skip fixture', 30, 'high', 'pending'),
  ('72000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001', 'Rollback fixture', 30, 'high', 'pending'),
  ('72000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000002', 'Other fixture', 30, 'high', 'pending');
insert into public.daily_plans (id, user_id, plan_date, timezone) values
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', current_date, 'Asia/Tokyo'),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', current_date, 'Asia/Tokyo');
insert into public.planned_actions (id, user_id, daily_plan_id, task_id, title, start_at, end_at)
select
  ('74000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  case when n = 6 then '71000000-0000-4000-8000-000000000002'::uuid else '71000000-0000-4000-8000-000000000001'::uuid end,
  case when n = 6 then '73000000-0000-4000-8000-000000000002'::uuid else '73000000-0000-4000-8000-000000000001'::uuid end,
  case n
    when 1 then '72000000-0000-4000-8000-000000000001'::uuid
    when 2 then '72000000-0000-4000-8000-000000000002'::uuid
    when 5 then '72000000-0000-4000-8000-000000000003'::uuid
    when 6 then '72000000-0000-4000-8000-000000000004'::uuid
    else null
  end,
  'Execution fixture ' || n,
  now() + n * interval '1 hour',
  now() + n * interval '1 hour' + interval '30 minutes'
from generate_series(1, 6) as n;

-- Inject a failure specifically in the Task update AFTER the Action update.
create function public.m5a_fail_task_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id = '72000000-0000-4000-8000-000000000003'::uuid then
    raise exception '5A injected Task failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger m5a_fail_task_update before update on public.tasks
for each row execute function public.m5a_fail_task_update();

set local role anon;
do $anon$
begin
  begin
    perform public.update_planned_action_status('74000000-0000-4000-8000-000000000001', 'completed');
    raise exception '5A: anon was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$anon$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $no_auth$
begin
  begin
    perform public.update_planned_action_status('74000000-0000-4000-8000-000000000001', 'completed');
    raise exception '5A: missing auth was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$no_auth$;
reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $execution$
declare
  result record;
  target text;
  timestamp_before timestamptz;
begin
  select * into result from public.update_planned_action_status('74000000-0000-4000-8000-000000000001', 'completed');
  if result.action_id <> '74000000-0000-4000-8000-000000000001'::uuid
    or result.action_status <> 'completed'
    or (select status from public.planned_actions where id = result.action_id) <> 'completed'
    or (select status from public.tasks where id = '72000000-0000-4000-8000-000000000001') <> 'completed' then
    raise exception '5A: complete + Task update failed';
  end if;
  perform public.update_planned_action_status('74000000-0000-4000-8000-000000000002', 'skipped');
  if (select status from public.planned_actions where id = '74000000-0000-4000-8000-000000000002') <> 'skipped'
    or (select status from public.tasks where id = '72000000-0000-4000-8000-000000000002') <> 'pending' then
    raise exception '5A: skip changed Task or failed';
  end if;

  perform public.update_planned_action_status('74000000-0000-4000-8000-000000000003', 'completed');
  perform public.update_planned_action_status('74000000-0000-4000-8000-000000000004', 'skipped');
  if (select status from public.planned_actions where id = '74000000-0000-4000-8000-000000000003') <> 'completed'
    or (select status from public.planned_actions where id = '74000000-0000-4000-8000-000000000004') <> 'skipped' then
    raise exception '5A: null Task execution failed';
  end if;

  -- Replays must not re-write an independently edited Task or touch Action timestamps.
  update public.tasks set status = 'pending' where id = '72000000-0000-4000-8000-000000000001';
  select updated_at into timestamp_before from public.planned_actions where id = '74000000-0000-4000-8000-000000000001';
  perform public.update_planned_action_status('74000000-0000-4000-8000-000000000001', 'completed');
  perform public.update_planned_action_status('74000000-0000-4000-8000-000000000002', 'skipped');
  if (select status from public.tasks where id = '72000000-0000-4000-8000-000000000001') <> 'pending'
    or (select updated_at from public.planned_actions where id = '74000000-0000-4000-8000-000000000001') <> timestamp_before then
    raise exception '5A: replay was not a no-op';
  end if;

  foreach target in array array['skipped', 'scheduled'] loop
    begin
      perform public.update_planned_action_status('74000000-0000-4000-8000-000000000001', target);
      raise exception '5A: completed transition was allowed';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  foreach target in array array['completed', 'scheduled'] loop
    begin
      perform public.update_planned_action_status('74000000-0000-4000-8000-000000000002', target);
      raise exception '5A: skipped transition was allowed';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  foreach target in array array['completed', 'skipped'] loop
    begin
      perform public.update_planned_action_status('74000000-0000-4000-8000-000000000006', target);
      raise exception '5A: other owner execution was allowed';
    exception when no_data_found then null;
    end;
  end loop;
  begin
    perform public.update_planned_action_status('74000000-0000-4000-8000-000000000005', 'completed');
    raise exception '5A: injected failure was not raised';
  exception when check_violation then null;
  end;
  if (select status from public.planned_actions where id = '74000000-0000-4000-8000-000000000005') <> 'scheduled'
    or (select status from public.tasks where id = '72000000-0000-4000-8000-000000000003') <> 'pending' then
    raise exception '5A: partial state left after failure';
  end if;
end;
$execution$;

reset role;
do $other_unchanged$
begin
  if (select status from public.planned_actions where id = '74000000-0000-4000-8000-000000000006') <> 'scheduled'
    or (select status from public.tasks where id = '72000000-0000-4000-8000-000000000004') <> 'pending' then
    raise exception '5A: other user state changed';
  end if;
end;
$other_unchanged$;
rollback;
