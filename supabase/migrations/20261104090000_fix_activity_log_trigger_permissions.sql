begin;

-- All row locks and writes belong to the private capability. The public invoker
-- wrapper performs no SELECT ... FOR UPDATE and needs NO client UPDATE grant.
revoke update on public.planned_actions from authenticated;
revoke update (id, user_id, daily_plan_id, task_id, title, start_at, end_at, reason, status, created_at, updated_at)
on public.planned_actions from authenticated;

-- INSERT remains available to replace_daily_plan(), but cannot manufacture a
-- terminal Action without the Execution path. Existing rows are not rewritten.
drop policy planned_actions_insert_own on public.planned_actions;
create policy planned_actions_insert_own on public.planned_actions
for insert to authenticated
with check ((select auth.uid()) = user_id and status = 'scheduled');

create schema planner_execution_private;
revoke all on schema planner_execution_private from public, anon, authenticated, service_role;
grant usage on schema planner_execution_private to authenticated, service_role;

create role ai_life_planner_execution_writer
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
grant ai_life_planner_execution_writer to postgres;
grant usage on schema public, planner_execution_private to ai_life_planner_execution_writer;

-- SQL-standard body is parsed and bound to auth.uid() at CREATE time by the
-- migration role, which already has namespace USAGE. At runtime this is INVOKER
-- and only returns the current request identity; it accepts no user-id argument.
-- The execution writer already has auth.uid EXECUTE through its existing PUBLIC
-- grant, but needs no auth namespace USAGE and receives no auth-schema GRANT.
create function planner_execution_private.actor_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
return auth.uid();
revoke all on function planner_execution_private.actor_id() from public, anon, authenticated, service_role;
grant execute on function planner_execution_private.actor_id() to ai_life_planner_execution_writer;

grant select (id, user_id), update (summary) on public.daily_plans to ai_life_planner_execution_writer;
grant select (id, user_id, daily_plan_id, task_id, status), update (status)
on public.planned_actions to ai_life_planner_execution_writer;
grant select (id, user_id, status), update (status) on public.tasks to ai_life_planner_execution_writer;

create policy daily_plans_execution_select on public.daily_plans
for select to ai_life_planner_execution_writer
using (user_id = (select planner_execution_private.actor_id()));
create policy daily_plans_execution_lock on public.daily_plans
for update to ai_life_planner_execution_writer
using (user_id = (select planner_execution_private.actor_id()))
with check (user_id = (select planner_execution_private.actor_id()));
create policy planned_actions_execution_select on public.planned_actions
for select to ai_life_planner_execution_writer
using (user_id = (select planner_execution_private.actor_id()));
create policy planned_actions_execution_update on public.planned_actions
for update to ai_life_planner_execution_writer
using (user_id = (select planner_execution_private.actor_id()))
with check (user_id = (select planner_execution_private.actor_id()));
create policy tasks_execution_select on public.tasks
for select to ai_life_planner_execution_writer
using (user_id = (select planner_execution_private.actor_id()));
create policy tasks_execution_update on public.tasks
for update to ai_life_planner_execution_writer
using (user_id = (select planner_execution_private.actor_id()))
with check (user_id = (select planner_execution_private.actor_id()));

-- Non-exposed-schema capability. Even a direct SQL caller must receive exactly
-- the same authenticated, locked, atomic Action+Task transition, never raw DML.
create function planner_execution_private.apply_transition(p_action_id uuid, p_target_status text)
returns table (action_id uuid, action_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := planner_execution_private.actor_id();
  plan_id uuid;
  action_record record;
begin
  if actor is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_action_id is null then raise exception 'Action id is required.' using errcode = '22004'; end if;
  if p_target_status is null or p_target_status not in ('completed', 'skipped') then
    raise exception 'Unsupported execution status.' using errcode = '22023';
  end if;
  select action.daily_plan_id into plan_id from public.planned_actions as action
  where action.id = p_action_id and action.user_id = actor;
  perform 1 from public.daily_plans as plan
  where plan.id = plan_id and plan.user_id = actor for update;
  if not found then raise exception 'Action not found or not owned.' using errcode = 'P0002'; end if;
  select action.id, action.task_id, action.status into action_record
  from public.planned_actions as action
  where action.id = p_action_id and action.daily_plan_id = plan_id and action.user_id = actor for update;
  if not found then raise exception 'Action not found or not owned.' using errcode = 'P0002'; end if;
  if action_record.status = p_target_status then
    return query select action_record.id, action_record.status;
    return;
  end if;
  if action_record.status <> 'scheduled' then
    raise exception 'Only scheduled Actions can transition.' using errcode = '22023';
  end if;
  if p_target_status = 'completed' and action_record.task_id is not null then
    perform 1 from public.tasks as task where task.id = action_record.task_id and task.user_id = actor for update;
    if not found then raise exception 'Task not found or not owned.' using errcode = 'P0002'; end if;
  end if;
  update public.planned_actions as action set status = p_target_status
  where action.id = action_record.id and action.user_id = actor;
  if not found then raise exception 'Action could not be updated.' using errcode = 'P0002'; end if;
  if p_target_status = 'completed' and action_record.task_id is not null then
    update public.tasks as task set status = 'completed'
    where task.id = action_record.task_id and task.user_id = actor;
    if not found then raise exception 'Task could not be updated.' using errcode = 'P0002'; end if;
  end if;
  return query select action_record.id, p_target_status;
end;
$$;
revoke all on function planner_execution_private.apply_transition(uuid, text) from public, anon, authenticated, service_role;
grant execute on function planner_execution_private.apply_transition(uuid, text) to authenticated, service_role;
grant create on schema planner_execution_private to ai_life_planner_execution_writer;
alter function planner_execution_private.apply_transition(uuid, text) owner to ai_life_planner_execution_writer;
revoke create on schema planner_execution_private from ai_life_planner_execution_writer;

-- Keep the public 5A RPC INVOKER with auth.uid(), argument and ownership checks.
-- Never decide status/no-op from an unlocked pre-read. The private capability
-- owns ALL locks, authoritative status checks and atomic writes.
create or replace function public.update_planned_action_status(p_action_id uuid, p_target_status text)
returns table (action_id uuid, action_status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_action_id is null then raise exception 'Action id is required.' using errcode = '22004'; end if;
  if p_target_status is null or p_target_status not in ('completed', 'skipped') then
    raise exception 'Unsupported execution status.' using errcode = '22023';
  end if;
  perform 1 from public.planned_actions as action
  join public.daily_plans as plan on plan.id = action.daily_plan_id and plan.user_id = action.user_id
  where action.id = p_action_id and action.user_id = current_user_id;
  if not found then raise exception 'Action not found or not owned.' using errcode = 'P0002'; end if;
  return query select result.action_id, result.action_status
  from planner_execution_private.apply_transition(p_action_id, p_target_status) as result;
end;
$$;

-- The logger performs snapshot generation only: no JWT/session identity lookup
-- in its body or its writer-specific policies. Clients cannot assume this role.
drop policy daily_plans_activity_writer_select on public.daily_plans;
create policy daily_plans_activity_writer_select on public.daily_plans
for select to ai_life_planner_activity_writer using (true);
drop policy activity_logs_writer_insert on public.activity_logs;
create policy activity_logs_writer_insert on public.activity_logs
for insert to ai_life_planner_activity_writer
with check (exists (
  select 1 from public.daily_plans as plan
  where plan.user_id = activity_logs.user_id and plan.plan_date = activity_logs.plan_date
    and plan.timezone = activity_logs.timezone
));

create or replace function public.record_planned_action_execution()
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
  if old.status <> 'scheduled' or new.status not in ('completed', 'skipped')
    or old.status is not distinct from new.status then return new; end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.daily_plan_id is distinct from old.daily_plan_id
    or new.task_id is distinct from old.task_id or new.title is distinct from old.title
    or new.start_at is distinct from old.start_at or new.end_at is distinct from old.end_at then
    raise exception 'Execution cannot simultaneously rewrite its Action context.' using errcode = '22023';
  end if;
  select plan.user_id, plan.plan_date, plan.timezone
  into plan_owner_id, snapshot_plan_date, snapshot_timezone
  from public.daily_plans as plan
  where plan.id = old.daily_plan_id and plan.user_id = old.user_id;
  if not found then raise exception 'Execution Plan relation not found.' using errcode = '23503'; end if;
  insert into public.activity_logs (
    user_id, event_type, planned_action_id, task_id, plan_date, timezone,
    action_title, scheduled_start_at, scheduled_end_at
  ) values (
    plan_owner_id,
    case new.status when 'completed' then 'planned_action_completed' else 'planned_action_skipped' end,
    old.id, old.task_id, snapshot_plan_date, snapshot_timezone, old.title, old.start_at, old.end_at
  );
  return new;
end;
$$;
revoke all on function public.record_planned_action_execution() from public, anon, authenticated, service_role;

commit;
