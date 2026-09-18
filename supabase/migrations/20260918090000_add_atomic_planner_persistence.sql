begin;

alter table public.daily_plans
add column timezone text;

update public.daily_plans as daily_plan
set timezone = profile.timezone
from public.profiles as profile
where profile.id = daily_plan.user_id;

alter table public.daily_plans
alter column timezone set not null;

alter table public.daily_plans
add constraint daily_plans_timezone_not_blank
check (length(btrim(timezone)) > 0);

create or replace function public.replace_daily_plan(
  p_plan_date date,
  p_timezone text,
  p_summary text,
  p_actions jsonb
)
returns table (
  daily_plan_id uuid,
  saved_action_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_timezone text;
  target_daily_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select profile.timezone
  into current_timezone
  from public.profiles as profile
  where profile.id = current_user_id;

  if current_timezone is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if p_plan_date is null then
    raise exception 'Plan date is required.' using errcode = '22004';
  end if;

  if p_timezone is null or length(btrim(p_timezone)) = 0 then
    raise exception 'Timezone is required.' using errcode = '22023';
  end if;

  if p_timezone <> current_timezone then
    raise exception 'Preview timezone no longer matches the profile timezone.'
      using errcode = '22023';
  end if;

  if p_plan_date <> (now() at time zone current_timezone)::date then
    raise exception 'Preview date is no longer the current profile-local date.'
      using errcode = '22023';
  end if;

  if p_summary is null or length(btrim(p_summary)) = 0 then
    raise exception 'Plan summary must not be blank.' using errcode = '22023';
  end if;

  if p_actions is null or jsonb_typeof(p_actions) <> 'array' then
    raise exception 'Actions must be a JSON array.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_actions) as item(action)
    where jsonb_typeof(action) <> 'object'
      or not action ?& array['task_id', 'title', 'start_at', 'end_at', 'reason']
      or (action -> 'task_id' <> 'null'::jsonb and jsonb_typeof(action -> 'task_id') <> 'string')
      or jsonb_typeof(action -> 'title') <> 'string'
      or jsonb_typeof(action -> 'start_at') <> 'string'
      or jsonb_typeof(action -> 'end_at') <> 'string'
      or jsonb_typeof(action -> 'reason') <> 'string'
  ) then
    raise exception 'An action has an invalid structure.' using errcode = '22023';
  end if;

  insert into public.daily_plans (user_id, plan_date, timezone, summary)
  values (current_user_id, p_plan_date, p_timezone, btrim(p_summary))
  on conflict (user_id, plan_date)
  do update set
    timezone = excluded.timezone,
    summary = excluded.summary
  returning id into target_daily_plan_id;

  delete from public.planned_actions as existing_action
  where existing_action.user_id = current_user_id
    and existing_action.daily_plan_id = target_daily_plan_id;

  insert into public.planned_actions (
    user_id,
    daily_plan_id,
    task_id,
    title,
    start_at,
    end_at,
    reason,
    status
  )
  select
    current_user_id,
    target_daily_plan_id,
    action.task_id,
    btrim(action.title),
    action.start_at,
    action.end_at,
    btrim(action.reason),
    'scheduled'
  from jsonb_to_recordset(p_actions) as action(
    task_id uuid,
    title text,
    start_at timestamptz,
    end_at timestamptz,
    reason text
  );

  return query
  select target_daily_plan_id, jsonb_array_length(p_actions);
end;
$$;

revoke all on function public.replace_daily_plan(date, text, text, jsonb)
from public, anon, authenticated;

grant execute on function public.replace_daily_plan(date, text, text, jsonb)
to authenticated;

grant execute on function public.replace_daily_plan(date, text, text, jsonb)
to service_role;

commit;
