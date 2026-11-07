begin;
alter table public.profiles add column planning_end_day_offset integer not null default 0 check (planning_end_day_offset in (0,1));
alter table public.profiles add constraint profiles_planning_duration check (
 extract(epoch from (planning_end-planning_start))/60 + planning_end_day_offset*1440 > 0 and
 extract(epoch from (planning_end-planning_start))/60 + planning_end_day_offset*1440 <= 1440
) not valid;
alter table public.daily_plans add column window_start_at timestamptz, add column window_end_at timestamptz;
update public.daily_plans set window_start_at=plan_date::timestamp at time zone timezone,
 window_end_at=(plan_date+1)::timestamp at time zone timezone;
alter table public.daily_plans add constraint daily_plan_window_valid check (
 (window_start_at is null and window_end_at is null) or
 (window_start_at is not null and window_end_at is not null and isfinite(window_start_at) and isfinite(window_end_at) and window_start_at < window_end_at)
);
create function public.planning_instant(p_local timestamp, p_timezone text) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
declare resolved timestamptz := p_local at time zone p_timezone; probe timestamptz; alternate timestamptz;
begin
 if resolved at time zone p_timezone <> p_local then raise exception 'Nonexistent planning local time' using errcode='22023'; end if;
 foreach probe in array array[resolved-interval '48 hours',resolved+interval '48 hours'] loop
  alternate := (p_local - ((probe at time zone p_timezone)-(probe at time zone 'UTC'))) at time zone 'UTC';
  if alternate <> resolved and alternate at time zone p_timezone = p_local then raise exception 'Ambiguous planning local time' using errcode='22023'; end if;
 end loop;
 return resolved;
end $$;
create function public.planning_date(p_now timestamptz,p_timezone text,p_start time,p_end time,p_offset integer) returns date
language plpgsql stable security invoker set search_path='' as $$
declare local_now timestamp := p_now at time zone p_timezone; duration interval := p_end-p_start+make_interval(days=>p_offset);
begin
 if p_now is null or p_timezone is null or p_start is null or p_end is null or p_offset not in (0,1) or p_offset is null or duration <= interval '0' or duration > interval '24 hours' then raise exception 'Invalid planning duration' using errcode='22023'; end if;
 return local_now::date - case when p_offset=1 and local_now::time < p_end then 1 else 0 end;
end $$;
revoke all on function public.planning_instant(timestamp,text), public.planning_date(timestamptz,text,time,time,integer) from public,anon;
grant execute on function public.planning_instant(timestamp,text), public.planning_date(timestamptz,text,time,time,integer) to authenticated,service_role;
create or replace function public.replace_daily_plan(
  p_plan_date date,
  p_timezone text,
  p_summary text,
  p_actions jsonb,
  p_planning_window jsonb
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
  profile_start time; profile_end time; profile_offset integer;
  window_start timestamptz; window_end timestamptz; checked_now timestamptz := clock_timestamp();
  target_daily_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select profile.timezone,profile.planning_start,profile.planning_end,profile.planning_end_day_offset
  into current_timezone,profile_start,profile_end,profile_offset
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

  if p_plan_date <> public.planning_date(checked_now,current_timezone,profile_start,profile_end,profile_offset) then
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

  window_start := public.planning_instant(p_plan_date+profile_start,current_timezone);
  window_end := public.planning_instant((p_plan_date+profile_offset)+profile_end,current_timezone);
  if window_end <= window_start then raise exception 'Invalid planning window' using errcode='22023'; end if;
  if p_planning_window is not null and (
    jsonb_typeof(p_planning_window) <> 'object' or not p_planning_window ?& array['startAt','endAt'] or
    (p_planning_window->>'startAt')::timestamptz is distinct from window_start or
    (p_planning_window->>'endAt')::timestamptz is distinct from window_end
  ) then raise exception 'Preview planning window changed' using errcode='22023'; end if;
  if exists(select 1 from jsonb_to_recordset(p_actions) as action(start_at timestamptz,end_at timestamptz)
    where action.start_at is null or action.end_at is null or not isfinite(action.start_at) or not isfinite(action.end_at) or action.start_at < window_start or action.end_at > window_end or action.start_at >= action.end_at
  ) then raise exception 'Action outside planning window' using errcode='22023'; end if;
  insert into public.daily_plans (user_id, plan_date, timezone, summary, window_start_at, window_end_at)
  values (current_user_id, p_plan_date, p_timezone, btrim(p_summary), window_start, window_end)
  on conflict (user_id, plan_date)
  do update set
    window_start_at = excluded.window_start_at,
    window_end_at = excluded.window_end_at,
    timezone = excluded.timezone,
    summary = excluded.summary
  returning id into target_daily_plan_id;

  -- The upsert may wait for another save. Recheck the date/settings AFTER the Plan lock.
  if p_plan_date <> public.planning_date(clock_timestamp(),current_timezone,profile_start,profile_end,profile_offset)
     or exists(select 1 from public.profiles as profile where profile.id=current_user_id and
       (profile.timezone,profile.planning_start,profile.planning_end,profile.planning_end_day_offset)
       is distinct from (current_timezone,profile_start,profile_end,profile_offset)) then
    raise exception 'Planning state changed while waiting to save' using errcode='22023';
  end if;

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


revoke all on function public.replace_daily_plan(date,text,text,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.replace_daily_plan(date,text,text,jsonb,jsonb) to authenticated,service_role;
-- Legacy callers retain the original signature; new callers carry a window token.
create or replace function public.replace_daily_plan(p_plan_date date,p_timezone text,p_summary text,p_actions jsonb)
returns table(daily_plan_id uuid,saved_action_count integer) language sql security invoker set search_path=''
as $$ select * from public.replace_daily_plan(p_plan_date,p_timezone,p_summary,p_actions,null::jsonb); $$;
create function public.replace_daily_plan_if_current(p_plan_date date,p_timezone text,p_summary text,p_actions jsonb,p_expected_snapshot jsonb,p_planning_window jsonb)
returns table(daily_plan_id uuid,saved_action_count integer) language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
 perform planner_execution_private.lock_replan_if_current(p_plan_date,p_expected_snapshot,p_actions);
 return query select saved.daily_plan_id,saved.saved_action_count from public.replace_daily_plan(p_plan_date,p_timezone,p_summary,p_actions,p_planning_window) as saved;
end $$;
revoke all on function public.replace_daily_plan_if_current(date,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.replace_daily_plan_if_current(date,text,text,jsonb,jsonb,jsonb) to authenticated,service_role;
commit;
