begin;

-- Keep the 5B capability role and its owner-scoped RLS. These extra columns are
-- read-only; authenticated still has NO planned_actions UPDATE privilege.
grant select (plan_date, timezone, summary, updated_at) on public.daily_plans
to ai_life_planner_execution_writer;
grant select (updated_at) on public.planned_actions to ai_life_planner_execution_writer;

-- A single statement supplies a consistent Plan + Action token. SQL-standard
-- body binds auth.uid at CREATE time, without granting auth namespace USAGE.
create function planner_execution_private.plan_snapshot(p_plan_date date)
returns jsonb
language sql stable security invoker set search_path = ''
return (
  select jsonb_build_object(
    'id', plan.id, 'planDate', plan.plan_date, 'timezone', plan.timezone,
    'summary', plan.summary,
    'updatedAt', to_char(plan.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', action.id, 'status', action.status,
        'updatedAt', to_char(action.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      ) order by action.id)
      from public.planned_actions as action
      where action.daily_plan_id = plan.id and action.user_id = plan.user_id
    ), '[]'::jsonb)
  )
  from public.daily_plans as plan
  where plan.user_id = auth.uid() and plan.plan_date = p_plan_date
);
revoke all on function planner_execution_private.plan_snapshot(date) from public, anon, authenticated, service_role;
grant execute on function planner_execution_private.plan_snapshot(date)
to authenticated, service_role, ai_life_planner_execution_writer;

create function public.get_daily_plan_snapshot(p_plan_date date)
returns jsonb
language sql stable security invoker set search_path = ''
return planner_execution_private.plan_snapshot(p_plan_date);
revoke all on function public.get_daily_plan_snapshot(date) from public, anon, authenticated, service_role;
grant execute on function public.get_daily_plan_snapshot(date) to authenticated, service_role;

-- This non-exposed capability only verifies and locks. The public INVOKER
-- continues into the existing replace RPC in the SAME transaction, under the
-- caller's RLS/grants. No UPDATE write surface is restored to the client.
create function planner_execution_private.lock_replan_if_current(
  p_plan_date date, p_expected_snapshot jsonb, p_actions jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := planner_execution_private.actor_id();
  plan_id uuid;
begin
  if actor is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_actions is null or jsonb_typeof(p_actions) <> 'array' then
    raise exception 'Actions must be an array.' using errcode = '22023';
  end if;
  select plan.id into plan_id from public.daily_plans as plan
  where plan.user_id = actor and plan.plan_date = p_plan_date for update;
  if not found then raise exception 'Replanning state changed.' using errcode = 'P5C01'; end if;

  perform action.id from public.planned_actions as action
  where action.user_id = actor and action.daily_plan_id = plan_id
  order by action.id for update;
  if p_expected_snapshot is distinct from planner_execution_private.plan_snapshot(p_plan_date) then
    raise exception 'Replanning state changed.' using errcode = 'P5C01';
  end if;

  -- Deterministic Task order, after ALL Action locks. Re-read status only after
  -- any concurrent Task edit has released its lock. Unrelated Tasks are ignored.
  perform task.id from public.tasks as task
  where task.user_id = actor and task.id in (
    select proposed.task_id from jsonb_to_recordset(p_actions) as proposed(task_id uuid)
    where proposed.task_id is not null
  ) order by task.id for update;
  if exists (
    select 1 from jsonb_to_recordset(p_actions) as proposed(task_id uuid)
    left join public.tasks as task on task.id = proposed.task_id and task.user_id = actor
    where proposed.task_id is not null and (task.id is null or task.status <> 'pending')
  ) then raise exception 'Replanning Task state changed.' using errcode = 'P5C01'; end if;

  -- Use the wall clock AFTER lock waits, not the transaction-start now().
  if exists (
    select 1 from jsonb_to_recordset(p_actions) as proposed(start_at timestamptz)
    where proposed.start_at < clock_timestamp()
  ) then raise exception 'Replanning time elapsed.' using errcode = 'P5C01'; end if;
end;
$$;
revoke all on function planner_execution_private.lock_replan_if_current(date, jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function planner_execution_private.lock_replan_if_current(date, jsonb, jsonb)
to authenticated, service_role;
grant create on schema planner_execution_private to ai_life_planner_execution_writer;
alter function planner_execution_private.lock_replan_if_current(date, jsonb, jsonb)
owner to ai_life_planner_execution_writer;
revoke create on schema planner_execution_private from ai_life_planner_execution_writer;

create function public.replace_daily_plan_if_current(
  p_plan_date date, p_timezone text, p_summary text, p_actions jsonb, p_expected_snapshot jsonb
)
returns table (daily_plan_id uuid, saved_action_count integer)
language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  perform planner_execution_private.lock_replan_if_current(p_plan_date, p_expected_snapshot, p_actions);
  return query select saved.daily_plan_id, saved.saved_action_count
  from public.replace_daily_plan(p_plan_date, p_timezone, p_summary, p_actions) as saved;
end;
$$;
revoke all on function public.replace_daily_plan_if_current(date, text, text, jsonb, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.replace_daily_plan_if_current(date, text, text, jsonb, jsonb)
to authenticated, service_role;

commit;
