-- Remote-only Milestone 4D verification.
-- Run only after applying 20260918090000_add_atomic_planner_persistence.sql.
-- All fixture writes occur inside this transaction and are rolled back.

begin;

set local statement_timeout = '30s';

do $catalog$
declare
  function_oid oid := to_regprocedure('public.replace_daily_plan(date,text,text,jsonb)');
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_plans'
      and column_name = 'timezone'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) then
    raise exception 'Milestone 4D verification failed: daily_plans.timezone differs';
  end if;

  if function_oid is null then
    raise exception 'Milestone 4D verification failed: replace_daily_plan is missing';
  end if;

  if (
    select procedure_info.prosecdef
    from pg_proc as procedure_info
    where procedure_info.oid = function_oid
  ) then
    raise exception 'Milestone 4D verification failed: replace_daily_plan must be security invoker';
  end if;

  if (
    select procedure_info.proconfig
    from pg_proc as procedure_info
    where procedure_info.oid = function_oid
  ) <> array['search_path=""'] then
    raise exception 'Milestone 4D verification failed: replace_daily_plan search_path differs';
  end if;

  if has_function_privilege('anon', function_oid, 'EXECUTE')
    or not has_function_privilege('authenticated', function_oid, 'EXECUTE') then
    raise exception 'Milestone 4D verification failed: replace_daily_plan grants differ';
  end if;
end;
$catalog$;

insert into auth.users (id, email)
values
  ('61000000-0000-4000-8000-000000000001', 'm4d-owner@example.invalid'),
  ('61000000-0000-4000-8000-000000000002', 'm4d-other@example.invalid');

insert into public.tasks (
  id,
  user_id,
  title,
  estimated_minutes,
  priority,
  status
)
values
  (
    '62000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    'Owner task',
    30,
    'high',
    'pending'
  ),
  (
    '62000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000002',
    'Other task',
    30,
    'high',
    'pending'
  );

set local role anon;

do $anon_denied$
begin
  begin
    perform public.replace_daily_plan(
      current_date,
      'Asia/Tokyo',
      'Anonymous plan',
      '[]'::jsonb
    );
    raise exception 'Milestone 4D verification failed: anon executed replace_daily_plan';
  exception when insufficient_privilege then null;
  end;
end;
$anon_denied$;

reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $replace_and_atomicity$
declare
  local_plan_date date := (now() at time zone 'Asia/Tokyo')::date;
  original_plan_id uuid;
  replaced_plan_id uuid;
  action_count integer;
begin
  select result.daily_plan_id, result.saved_action_count
  into original_plan_id, action_count
  from public.replace_daily_plan(
    local_plan_date,
    'Asia/Tokyo',
    'Initial plan',
    jsonb_build_array(
      jsonb_build_object(
        'task_id', '62000000-0000-4000-8000-000000000001',
        'title', 'Owner task',
        'start_at', ((local_plan_date + time '09:00') at time zone 'Asia/Tokyo'),
        'end_at', ((local_plan_date + time '09:30') at time zone 'Asia/Tokyo'),
        'reason', 'Initial reason'
      ),
      jsonb_build_object(
        'task_id', null,
        'title', 'Break',
        'start_at', ((local_plan_date + time '10:00') at time zone 'Asia/Tokyo'),
        'end_at', ((local_plan_date + time '10:15') at time zone 'Asia/Tokyo'),
        'reason', 'Free action verification'
      )
    )
  ) as result;

  if action_count <> 2
    or (select count(*) from public.daily_plans) <> 1
    or (select count(*) from public.planned_actions) <> 2
    or not exists (
      select 1
      from public.daily_plans
      where id = original_plan_id
        and plan_date = local_plan_date
        and timezone = 'Asia/Tokyo'
        and summary = 'Initial plan'
    )
    or not exists (
      select 1
      from public.planned_actions
      where daily_plan_id = original_plan_id
        and task_id is null
        and status = 'scheduled'
    ) then
    raise exception 'Milestone 4D verification failed: initial save differs';
  end if;

  select result.daily_plan_id, result.saved_action_count
  into replaced_plan_id, action_count
  from public.replace_daily_plan(
    local_plan_date,
    'Asia/Tokyo',
    'Replacement plan',
    jsonb_build_array(
      jsonb_build_object(
        'task_id', '62000000-0000-4000-8000-000000000001',
        'title', 'Owner replacement',
        'start_at', ((local_plan_date + time '11:00') at time zone 'Asia/Tokyo'),
        'end_at', ((local_plan_date + time '11:30') at time zone 'Asia/Tokyo'),
        'reason', 'Replacement reason'
      )
    )
  ) as result;

  if replaced_plan_id <> original_plan_id
    or action_count <> 1
    or (select count(*) from public.daily_plans) <> 1
    or (select count(*) from public.planned_actions) <> 1
    or not exists (
      select 1
      from public.planned_actions
      where daily_plan_id = original_plan_id
        and title = 'Owner replacement'
    ) then
    raise exception 'Milestone 4D verification failed: atomic replace differs';
  end if;

  select result.daily_plan_id, result.saved_action_count
  into replaced_plan_id, action_count
  from public.replace_daily_plan(
    local_plan_date,
    'Asia/Tokyo',
    'Replacement plan',
    jsonb_build_array(
      jsonb_build_object(
        'task_id', '62000000-0000-4000-8000-000000000001',
        'title', 'Owner replacement',
        'start_at', ((local_plan_date + time '11:00') at time zone 'Asia/Tokyo'),
        'end_at', ((local_plan_date + time '11:30') at time zone 'Asia/Tokyo'),
        'reason', 'Replacement reason'
      )
    )
  ) as result;

  if replaced_plan_id <> original_plan_id
    or action_count <> 1
    or (select count(*) from public.planned_actions) <> 1 then
    raise exception 'Milestone 4D verification failed: repeated approval duplicated actions';
  end if;

  begin
    perform public.replace_daily_plan(
      local_plan_date,
      'Asia/Tokyo',
      'Must roll back',
      jsonb_build_array(
        jsonb_build_object(
          'task_id', '62000000-0000-4000-8000-000000000002',
          'title', 'Other task',
          'start_at', ((local_plan_date + time '12:00') at time zone 'Asia/Tokyo'),
          'end_at', ((local_plan_date + time '12:30') at time zone 'Asia/Tokyo'),
          'reason', 'Must fail ownership FK'
        )
      )
    );
    raise exception 'Milestone 4D verification failed: cross-user task was saved';
  exception when foreign_key_violation then null;
  end;

  if not exists (
    select 1
    from public.daily_plans
    where id = original_plan_id
      and summary = 'Replacement plan'
  ) or not exists (
    select 1
    from public.planned_actions
    where daily_plan_id = original_plan_id
      and title = 'Owner replacement'
  ) then
    raise exception 'Milestone 4D verification failed: failed replacement left partial state';
  end if;

  select result.saved_action_count
  into action_count
  from public.replace_daily_plan(
    local_plan_date,
    'Asia/Tokyo',
    'Empty replacement',
    '[]'::jsonb
  ) as result;

  if action_count <> 0
    or (select count(*) from public.daily_plans) <> 1
    or (select count(*) from public.planned_actions) <> 0 then
    raise exception 'Milestone 4D verification failed: zero-action replacement differs';
  end if;

  if exists (
    select 1
    from public.tasks
    where id = '62000000-0000-4000-8000-000000000001'
      and status <> 'pending'
  ) then
    raise exception 'Milestone 4D verification failed: Task status changed';
  end if;
end;
$replace_and_atomicity$;

rollback;
