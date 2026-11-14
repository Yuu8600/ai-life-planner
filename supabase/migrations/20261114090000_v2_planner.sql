begin;

alter table public.tasks
  add column deadline_local date,
  add column recurrence text not null default 'once',
  add column recurrence_days smallint[] not null default '{}',
  add constraint v2_task_recurrence check (
    array_position(recurrence_days, null) is null
    and recurrence_days <@ array[1,2,3,4,5,6,7]::smallint[]
    and ((recurrence in ('once', 'daily') and cardinality(recurrence_days) = 0)
      or (recurrence in ('weekdays', 'weekly') and cardinality(recurrence_days) between 1 and 7))
  );

-- A V1 deadline write invalidates the date-only override. V2 writes both representations.
create function public.v2_sync_legacy_deadline() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deadline is distinct from old.deadline and new.deadline_local is not distinct from old.deadline_local
    and (new.deadline is null or not exists (
      select 1 from public.profiles p where p.id = new.user_id
        and (new.deadline at time zone p.timezone)::date = new.deadline_local
    )) then
    new.deadline_local := null;
  end if;
  return new;
end;
$$;
revoke all on function public.v2_sync_legacy_deadline() from public, anon, authenticated;
create trigger v2_sync_legacy_deadline before update of deadline on public.tasks
  for each row execute function public.v2_sync_legacy_deadline();

alter table public.profiles add column v2_task_gap_minutes integer not null default 30
  check (v2_task_gap_minutes between 0 and 240);

create function public.v2_unique_weekdays(days smallint[]) returns boolean
language sql immutable strict set search_path = '' as $$
  select cardinality(days) = (select count(distinct day) from unnest(days) as day)
$$;
revoke all on function public.v2_unique_weekdays(smallint[]) from public, anon;
grant execute on function public.v2_unique_weekdays(smallint[]) to authenticated, service_role;
alter table public.tasks add constraint v2_task_unique_weekdays
  check (public.v2_unique_weekdays(recurrence_days));

create table public.v2_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  plan_date date not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  kind text not null check (kind in ('fixed', 'flexible')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes integer,
  travel_before integer not null default 0 check (travel_before between 0 and 240),
  travel_after integer not null default 0 check (travel_after between 0 and 240),
  check (end_at > start_at and end_at - start_at <= interval '25 hours'),
  check ((kind = 'fixed' and duration_minutes is null) or
    (kind = 'flexible' and duration_minutes is not null and duration_minutes > 0
     and duration_minutes * interval '1 minute' <= end_at - start_at
     and travel_before = 0 and travel_after = 0))
);
create index v2_events_by_day on public.v2_events (user_id, plan_date);
alter table public.v2_events enable row level security;
revoke all on public.v2_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.v2_events to authenticated;
create policy v2_events_own on public.v2_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.v2_plans (
  user_id uuid not null references public.profiles on delete cascade,
  plan_date date not null,
  revision uuid not null default gen_random_uuid(),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  primary key (user_id, plan_date)
);
alter table public.v2_plans enable row level security;
revoke all on public.v2_plans from public, anon, authenticated, service_role;
grant select on public.v2_plans to authenticated;
create policy v2_plans_own on public.v2_plans for select to authenticated
  using (user_id = (select auth.uid()));

-- Include V1 writes to shared settings, Goals, Tasks and event buffers in the revision check.
-- Calendar availability is device-local and is rechecked by the app immediately before the RPC.
create function public.v2_plan_source(p_date date) returns text
language sql stable security invoker set search_path = '' as $$
  select md5(jsonb_build_array(
    (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    (select jsonb_agg(to_jsonb(t) order by id) from public.tasks t where t.user_id = auth.uid()),
    (select jsonb_agg(to_jsonb(g) order by id) from public.goals g where g.user_id = auth.uid()),
    (select jsonb_agg(to_jsonb(e) order by id) from public.v2_events e
      where e.user_id = auth.uid() and e.plan_date between p_date - 2 and p_date + 2),
    (select jsonb_agg(jsonb_build_array(d.plan_date,d.revision) order by d.plan_date)
      from public.v2_plans d where d.user_id=auth.uid() and d.plan_date between p_date - 90 and p_date + 6
        and d.plan_date <> p_date),
    (select jsonb_agg(to_jsonb(b) order by to_jsonb(b)) from public.calendar_event_buffer_overrides b
      where b.user_id = auth.uid())
  )::text)
$$;
revoke all on function public.v2_plan_source(date) from public, anon, authenticated, service_role;
grant execute on function public.v2_plan_source(date) to authenticated;

create function public.v2_save_plan(
  p_date date, p_expected_revision uuid, p_source text, p_state jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  previous public.v2_plans%rowtype;
  next_revision uuid := gen_random_uuid();
  item record;
  old_item jsonb;
  action_start timestamptz;
  action_end timestamptz;
  window_start timestamptz;
  window_end timestamptz;
  current_time_at_save timestamptz;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  -- Serialize this user's commits, and prevent concurrent changes to the DB inputs between
  -- the final source check and commit (including writes from clients using the V1 APIs).
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 2));
  lock table public.profiles, public.tasks, public.goals, public.v2_events,
    public.calendar_event_buffer_overrides in share mode;
  select * into previous from public.v2_plans where user_id = owner_id and plan_date = p_date;
  if previous.revision is distinct from p_expected_revision or p_source is null
    or public.v2_plan_source(p_date) is distinct from p_source then
    raise exception 'Stale plan preview' using errcode = '40001';
  end if;

  current_time_at_save := clock_timestamp();
  if p_state is null or pg_column_size(p_state) > 1048576
    or (p_state ->> 'date')::date is distinct from p_date
    or jsonb_typeof(p_state -> 'sessions') is distinct from 'array'
    or jsonb_array_length(p_state -> 'sessions') > 1500
    or jsonb_typeof(p_state -> 'leisure') is distinct from 'array'
    or jsonb_typeof(p_state -> 'lifestyle') is distinct from 'array'
    or jsonb_typeof(p_state -> 'unplaced') is distinct from 'array'
    or jsonb_typeof(p_state -> 'warnings') is distinct from 'array'
    or jsonb_typeof(p_state -> 'limited') is distinct from 'boolean'
    or coalesce(p_state ->> 'timezone','') = '' then
    raise exception 'Invalid plan';
  end if;
  if previous.state is not null and (
    previous.state -> 'window' is distinct from p_state -> 'window'
    or previous.state -> 'leisure' is distinct from p_state -> 'leisure'
  ) then raise exception 'Protected plan time'; end if;

  select public.planning_instant(p_date + p.planning_start, p.timezone),
    public.planning_instant(p_date + p.planning_end_day_offset + p.planning_end, p.timezone)
    into window_start, window_end from public.profiles p where p.id = owner_id;
  if previous.state is not null then
    window_start := (previous.state #>> '{window,startAt}')::timestamptz;
    window_end := (previous.state #>> '{window,endAt}')::timestamptz;
  end if;
  if (p_state #>> '{window,startAt}')::timestamptz is distinct from window_start
    or (p_state #>> '{window,endAt}')::timestamptz is distinct from window_end then
    raise exception 'Invalid planning window';
  end if;

  for item in select value as body from jsonb_array_elements(p_state -> 'sessions') loop
    action_start := (item.body ->> 'startAt')::timestamptz;
    action_end := (item.body ->> 'endAt')::timestamptz;
    select value into old_item from jsonb_array_elements(previous.state -> 'sessions')
      where value ->> 'id' = item.body ->> 'id';
    if coalesce(item.body ->> 'id', '') = '' or action_start is null or action_end is null
      or action_start < window_start or action_end > window_end or action_end <= action_start
      or coalesce(item.body ->> 'status', '') not in ('scheduled','completed','skipped','deferred')
      or jsonb_typeof(item.body -> 'locked') is distinct from 'boolean'
      or (select count(*) from jsonb_array_elements(p_state -> 'sessions') s
        where s ->> 'id' = item.body ->> 'id') > 1 then
      raise exception 'Invalid work session';
    end if;
    if (old_item is null or item.body -> 'startAt' is distinct from old_item -> 'startAt'
        or item.body -> 'endAt' is distinct from old_item -> 'endAt')
      and exists (
        select 1 from jsonb_array_elements((p_state -> 'leisure') || (p_state -> 'lifestyle')) b
        where action_start < (b ->> 'endAt')::timestamptz and (b ->> 'startAt')::timestamptz < action_end
      ) then raise exception 'Work overlaps protected time'; end if;
    if old_item is null then
      if action_start < current_time_at_save or item.body ->> 'status' <> 'scheduled'
        or not exists (select 1 from public.tasks t where t.id = (item.body ->> 'taskId')::uuid
          and t.user_id = owner_id and t.status <> 'completed') then
        raise exception 'Invalid new work session';
      end if;
    elsif old_item ->> 'status' <> 'scheduled' and item.body is distinct from old_item then
      raise exception 'Cannot edit stored work records';
    elsif item.body -> 'taskId' is distinct from old_item -> 'taskId' then
      raise exception 'Cannot change session task';
    elsif (item.body -> 'startAt' is distinct from old_item -> 'startAt'
      or item.body -> 'endAt' is distinct from old_item -> 'endAt')
      and (action_start < current_time_at_save or old_item ->> 'status' <> 'scheduled'
        or (old_item ->> 'startAt')::timestamptz <= current_time_at_save
        or item.body ->> 'status' <> 'scheduled') then
      raise exception 'Cannot change protected session time';
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(previous.state -> 'sessions') prior
    where not exists (
      select 1 from jsonb_array_elements(p_state -> 'sessions') next
      where next ->> 'id' = prior ->> 'id'
        and (prior ->> 'status' = 'scheduled' or next = prior)
    )
  ) then raise exception 'Cannot remove stored work records'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_state -> 'sessions') a
    join jsonb_array_elements(p_state -> 'sessions') b on (a ->> 'id') < (b ->> 'id')
    where a ->> 'status' in ('scheduled','completed') and b ->> 'status' in ('scheduled','completed')
      and (a ->> 'startAt')::timestamptz < (b ->> 'endAt')::timestamptz
      and (b ->> 'startAt')::timestamptz < (a ->> 'endAt')::timestamptz
  ) then raise exception 'Overlapping work sessions'; end if;

  insert into public.v2_plans (user_id, plan_date, revision, state)
    values (owner_id, p_date, next_revision, p_state)
    on conflict (user_id, plan_date) do update set revision = excluded.revision, state = excluded.state;
  return next_revision;
end;
$$;
revoke all on function public.v2_save_plan(date, uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.v2_save_plan(date, uuid, text, jsonb) to authenticated;

commit;
