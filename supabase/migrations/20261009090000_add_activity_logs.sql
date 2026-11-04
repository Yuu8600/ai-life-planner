begin;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  -- Immutable reference snapshots, deliberately NOT FKs. Replacing/deleting an
  -- Action or Task must neither delete nor rewrite the historical event.
  planned_action_id uuid,
  task_id uuid,
  plan_date date not null,
  timezone text not null,
  action_title text not null,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  constraint activity_logs_event_type_valid
    check (event_type in ('planned_action_completed', 'planned_action_skipped')),
  constraint activity_logs_title_not_blank check (length(btrim(action_title)) > 0),
  constraint activity_logs_timezone_not_blank check (length(btrim(timezone)) > 0),
  constraint activity_logs_time_range_valid check (scheduled_start_at < scheduled_end_at)
);

create index activity_logs_user_plan_date_occurred_idx
on public.activity_logs (user_id, plan_date, occurred_at desc, id desc);

alter table public.activity_logs enable row level security;
revoke all on table public.activity_logs from public, anon, authenticated, service_role;
grant select on table public.activity_logs to authenticated, service_role;

create policy activity_logs_select_own on public.activity_logs
for select to authenticated using ((select auth.uid()) = user_id);

-- The trigger needs INSERT while clients must not have it. Use a dedicated
-- non-login, non-bypass role rather than giving the function a superuser owner.
create role ai_life_planner_activity_writer
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
grant ai_life_planner_activity_writer to postgres;
grant usage on schema public, auth to ai_life_planner_activity_writer;
grant execute on function auth.uid() to ai_life_planner_activity_writer;
grant select (id, user_id, plan_date, timezone) on public.daily_plans
to ai_life_planner_activity_writer;
grant insert on public.activity_logs to ai_life_planner_activity_writer;
create policy daily_plans_activity_writer_select on public.daily_plans
for select to ai_life_planner_activity_writer using ((select auth.uid()) = user_id);
create policy activity_logs_writer_insert on public.activity_logs
for insert to ai_life_planner_activity_writer with check ((select auth.uid()) = user_id);

create function public.record_planned_action_execution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_owner_id uuid;
  snapshot_plan_date date;
  snapshot_timezone text;
begin
  -- Defense in depth in addition to the trigger WHEN condition.
  if old.status <> 'scheduled' or new.status not in ('completed', 'skipped')
    or old.status is not distinct from new.status then
    return new;
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.daily_plan_id is distinct from old.daily_plan_id
    or new.task_id is distinct from old.task_id or new.title is distinct from old.title
    or new.start_at is distinct from old.start_at or new.end_at is distinct from old.end_at then
    raise exception 'Execution cannot simultaneously rewrite its Action context.' using errcode = '22023';
  end if;

  -- Derive owner/date/timezone from the stored Plan, never from a client log payload.
  select plan.user_id, plan.plan_date, plan.timezone
  into plan_owner_id, snapshot_plan_date, snapshot_timezone
  from public.daily_plans as plan
  where plan.id = old.daily_plan_id and plan.user_id = old.user_id
    and plan.user_id = auth.uid();
  if not found then
    raise exception 'Execution Plan not found or not owned.' using errcode = '42501';
  end if;

  insert into public.activity_logs (
    user_id, event_type, planned_action_id, task_id, plan_date, timezone,
    action_title, scheduled_start_at, scheduled_end_at
  ) values (
    plan_owner_id,
    case new.status when 'completed' then 'planned_action_completed' else 'planned_action_skipped' end,
    old.id, old.task_id, snapshot_plan_date, snapshot_timezone,
    old.title, old.start_at, old.end_at
  );
  return new;
end;
$$;

revoke all on function public.record_planned_action_execution()
from public, anon, authenticated, service_role;
create trigger planned_actions_record_execution
after update of status on public.planned_actions
for each row
when (old.status = 'scheduled' and new.status in ('completed', 'skipped')
  and old.status is distinct from new.status)
execute function public.record_planned_action_execution();

-- CREATE is needed only for the ownership transfer, not at runtime.
grant create on schema public to ai_life_planner_activity_writer;
alter function public.record_planned_action_execution() owner to ai_life_planner_activity_writer;
revoke create on schema public from ai_life_planner_activity_writer;

-- Intentionally no backfill: pre-5B final statuses have no known execution instant.
commit;
