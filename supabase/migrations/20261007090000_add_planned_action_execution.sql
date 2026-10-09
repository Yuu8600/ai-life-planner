begin;

create or replace function public.update_planned_action_status(
  p_action_id uuid,
  p_target_status text
)
returns table (action_id uuid, action_status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_plan_id uuid;
  current_action public.planned_actions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_action_id is null then
    raise exception 'Action id is required.' using errcode = '22004';
  end if;
  if p_target_status is null or p_target_status not in ('completed', 'skipped') then
    raise exception 'Unsupported execution status.' using errcode = '22023';
  end if;

  select action.daily_plan_id into target_plan_id
  from public.planned_actions as action
  where action.id = p_action_id and action.user_id = current_user_id;

  -- Match replace_daily_plan's lock order: plan, then action, then task.
  -- A concurrent replacement cannot delete an Action midway through execution.
  perform 1 from public.daily_plans as plan
  where plan.id = target_plan_id and plan.user_id = current_user_id
  for update;
  if not found then
    raise exception 'Action not found or not owned.' using errcode = 'P0002';
  end if;

  select action.* into current_action
  from public.planned_actions as action
  where action.id = p_action_id
    and action.daily_plan_id = target_plan_id
    and action.user_id = current_user_id
  for update;
  if not found then
    raise exception 'Action not found or not owned.' using errcode = 'P0002';
  end if;

  -- Replays are no-ops: do not touch timestamps or re-complete a subsequently edited Task.
  if current_action.status = p_target_status then
    return query select current_action.id, current_action.status;
    return;
  end if;
  if current_action.status <> 'scheduled' then
    raise exception 'Only scheduled Actions can transition.' using errcode = '22023';
  end if;

  if p_target_status = 'completed' and current_action.task_id is not null then
    perform 1 from public.tasks as task
    where task.id = current_action.task_id and task.user_id = current_user_id
    for update;
    if not found then
      raise exception 'Task not found or not owned.' using errcode = 'P0002';
    end if;
  end if;

  update public.planned_actions as action
  set status = p_target_status
  where action.id = current_action.id and action.user_id = current_user_id;
  if not found then
    raise exception 'Action could not be updated.' using errcode = 'P0002';
  end if;

  -- MVP: a linked Action represents the whole Task (no Task splitting).
  if p_target_status = 'completed' and current_action.task_id is not null then
    update public.tasks as task
    set status = 'completed'
    where task.id = current_action.task_id and task.user_id = current_user_id;
    if not found then
      raise exception 'Task could not be updated.' using errcode = 'P0002';
    end if;
  end if;

  return query select current_action.id, p_target_status;
end;
$$;

revoke all on function public.update_planned_action_status(uuid, text)
from public, anon, authenticated;
grant execute on function public.update_planned_action_status(uuid, text)
to authenticated, service_role;

commit;
