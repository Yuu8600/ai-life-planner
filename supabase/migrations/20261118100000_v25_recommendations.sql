begin;

alter table public.tasks alter column estimated_minutes drop not null;

create table public.action_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  task_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  estimated_minutes integer check (estimated_minutes between 1 and 1440),
  effort text check (effort in ('light', 'normal', 'focus')),
  repeatable boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade
);
create index action_steps_owner_task_idx on public.action_steps(user_id, task_id);

-- Snapshot titles so deleting a task or a step does not erase the user's record.
create table public.recommendation_results (
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  target_kind text not null check (target_kind in ('task', 'step')),
  target_id uuid not null,
  task_id uuid not null,
  goal_id uuid,
  title text not null check (length(btrim(title)) > 0),
  outcome text not null check (outcome in ('completed', 'skipped')),
  created_at timestamptz not null default now(),
  primary key (user_id, local_date, target_kind, target_id)
);

alter table public.action_steps enable row level security;
alter table public.recommendation_results enable row level security;
revoke all on public.action_steps, public.recommendation_results from public, anon, authenticated;
grant select, delete on public.action_steps to authenticated;
grant insert (task_id, title, estimated_minutes, effort, repeatable)
  on public.action_steps to authenticated;
grant update (title, estimated_minutes, effort, repeatable)
  on public.action_steps to authenticated;
grant select on public.recommendation_results to authenticated;

create policy action_steps_own on public.action_steps to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recommendation_results_read_own on public.recommendation_results
  for select to authenticated using (user_id = (select auth.uid()));

create function public.record_recommendation_result(
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
  if task.status in ('completed', 'skipped') then
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
    (user_id, local_date, target_kind, target_id, task_id, goal_id, title, outcome)
  values (uid, p_date, p_kind, p_id, task.id, task.goal_id, coalesce(step.title, task.title), p_outcome);

  if p_outcome = 'completed' and p_kind = 'task' and task.recurrence = 'once' then
    update public.tasks set status = 'completed' where id = task.id and user_id = uid;
  elsif p_outcome = 'completed' and p_kind = 'step' and not step.repeatable then
    update public.action_steps set completed_at = statement_timestamp() where id = step.id and user_id = uid;
  end if;
  return p_outcome;
end;
$$;
revoke all on function public.record_recommendation_result(date, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_recommendation_result(date, text, uuid, text) to authenticated;

commit;
