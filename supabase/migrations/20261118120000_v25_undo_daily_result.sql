begin;

alter table public.recommendation_results
  add column previous_task_status text check (previous_task_status in ('pending', 'scheduled', 'skipped'));

create or replace function public.record_recommendation_result(
  p_date date, p_kind text, p_id uuid, p_outcome text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  task public.tasks%rowtype;
  step public.action_steps%rowtype;
  recorded text;
  tz text;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_date is null or p_id is null or p_kind is null or p_outcome is null
    or p_kind not in ('task', 'step') or p_outcome not in ('completed', 'skipped') then
    raise exception 'Invalid recommendation result' using errcode = '22023';
  end if;

  -- Serialize retries and conflicting actions on the same parent. Keep repeatable actions per day.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 25));
  select outcome into recorded from public.recommendation_results
    where user_id = uid and local_date = p_date and target_kind = p_kind and target_id = p_id;
  if found then return recorded; end if;

  select timezone into tz from public.profiles where id = uid;
  if p_date is distinct from (statement_timestamp() at time zone tz)::date then
    raise exception 'Recommendation day changed' using errcode = '22023';
  end if;
  select * into task from public.tasks where user_id = uid and id = case
    when p_kind = 'task' then p_id
    else (select task_id from public.action_steps where user_id = uid and id = p_id)
  end for update;
  if not found then raise exception 'Missing task' using errcode = '42501'; end if;
  if task.status = 'completed' or (task.status = 'skipped' and p_kind = 'step') then
    raise exception 'Task is no longer actionable' using errcode = '22023';
  end if;

  if p_kind = 'step' then
    select * into step from public.action_steps where user_id = uid
      and id = p_id and task_id = task.id for update;
    if not found then raise exception 'Missing step' using errcode = '42501'; end if;
    if step.completed_at is not null then
      raise exception 'Step is already completed' using errcode = '22023';
    end if;
  end if;

  insert into public.recommendation_results
    (user_id, local_date, target_kind, target_id, task_id, goal_id, title, outcome, previous_task_status)
  values (uid, p_date, p_kind, p_id, task.id, task.goal_id, coalesce(step.title, task.title), p_outcome,
    case when p_outcome = 'completed' and p_kind = 'task' and task.recurrence = 'once' then task.status end);

  if p_outcome = 'completed' and p_kind = 'task' and task.recurrence = 'once' then
    update public.tasks set status = 'completed' where id = task.id and user_id = uid;
  elsif p_outcome = 'completed' and p_kind = 'step' and not step.repeatable then
    update public.action_steps set completed_at = statement_timestamp() where id = step.id and user_id = uid;
  end if;
  return p_outcome;
end;
$$;
create function public.undo_recommendation_result(
  p_date date, p_kind text, p_id uuid, p_expected text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  saved public.recommendation_results%rowtype;
  tz text;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind is null or p_id is null or p_expected is null or
    p_kind not in ('task', 'step') or p_expected not in ('completed', 'skipped', 'reopen') or
    (p_expected = 'reopen' and p_kind <> 'task') then
    raise exception 'Invalid target or outcome' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 25));
  select timezone into tz from public.profiles where id = uid;
  if tz is null or p_date is distinct from (statement_timestamp() at time zone tz)::date then
    raise exception 'Recommendation day changed' using errcode = '22023';
  end if;

  select * into saved from public.recommendation_results
    where user_id = uid and local_date = p_date and target_kind = p_kind and target_id = p_id;
  if not found then
    -- Reopen a Task completed before daily results existed or on an earlier date.
    if p_expected = 'reopen' then
      update public.tasks set status = 'pending'
        where user_id = uid and id = p_id and status = 'completed';
    end if;
    return;
  end if;
  if saved.outcome <> p_expected then
    raise exception 'Recommendation result changed' using errcode = '40001';
  end if;

  if p_expected = 'completed' and p_kind = 'task' then
    update public.tasks set status = coalesce(saved.previous_task_status, 'pending')
      where user_id = uid and id = p_id and status = 'completed'
        and (saved.previous_task_status is not null or recurrence = 'once');
  elsif p_expected = 'completed' and p_kind = 'step' then
    update public.action_steps set completed_at = null
      where user_id = uid and id = p_id and (completed_at at time zone tz)::date = p_date;
  end if;

  delete from public.recommendation_results where user_id = uid and local_date = p_date
    and target_kind = p_kind and target_id = p_id;
end;
$$;
revoke all on function public.undo_recommendation_result(date, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.undo_recommendation_result(date, text, uuid, text) to authenticated;

commit;
