begin;

-- Extend the existing atomic draft approval to new Action Steps and Goal-linked Tasks.
create or replace function public.v2_approve_draft(p_id uuid,p_revision uuid,p_selected text[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  draft public.v2_drafts%rowtype;
  item jsonb;
  key text;
  goal uuid;
  parent_task uuid;
  linked jsonb := '{}'::jsonb;
  tz text;
  local_deadline date;
  affected integer;
begin
  select * into draft from public.v2_drafts where id=p_id and user_id=uid for update;
  if not found then raise exception 'Missing draft' using errcode='42501'; end if;
  if draft.approved_at is not null then return false; end if;
  if draft.revision is distinct from p_revision then raise exception 'Stale draft' using errcode='40001'; end if;
  if coalesce(cardinality(p_selected),0)=0 or array_position(p_selected,null) is not null
    or (select count(distinct x) from unnest(p_selected) x) <> cardinality(p_selected)
    or (select count(*) from jsonb_array_elements(draft.items) i where i ->> 'key'=any(p_selected)) <> cardinality(p_selected) then
    raise exception 'Invalid selection';
  end if;
  select timezone into tz from public.profiles where id=uid;
  for item in select value from jsonb_array_elements(draft.items)
    where value ->> 'key'=any(p_selected)
    order by case value ->> 'kind' when 'step' then 0 when 'goal' then 1 else 2 end loop
    key := item ->> 'key';
    local_deadline := nullif(item ->> 'deadline','')::date;
    if item ->> 'kind'='goal' then
      if item ->> 'targetId' is null then
        insert into public.goals (user_id,title,description,deadline,priority,status)
        values(uid,item ->> 'title',item ->> 'description',local_deadline,item ->> 'priority','active') returning id into goal;
      else
        update public.goals set title=item ->> 'title',deadline=local_deadline,priority=item ->> 'priority'
          where id=(item ->> 'targetId')::uuid and user_id=uid and updated_at=(item ->> 'expectedUpdatedAt')::timestamptz
          and title=(item #>> '{before,title}') and deadline is not distinct from nullif(item #>> '{before,deadline}','')::date
          and priority=(item #>> '{before,priority}')
          returning id into goal;
        if not found then raise exception 'Stale goal' using errcode='40001'; end if;
      end if;
      linked := linked || jsonb_build_object(key,goal);
    elsif item ->> 'kind'='step' then
      select id into parent_task from public.tasks
        where id=(item ->> 'taskId')::uuid and user_id=uid
        and status not in ('completed', 'skipped')
        and updated_at=(item ->> 'parentUpdatedAt')::timestamptz for share;
      if not found then raise exception 'Stale step parent' using errcode='40001'; end if;
      insert into public.action_steps (user_id, task_id, title, estimated_minutes)
        values(uid, parent_task, item ->> 'title', (item ->> 'minutes')::integer);
    elsif item ->> 'kind'='task' then
      goal := null;
      if item ->> 'goalId' is not null then
        if item ->> 'goalKey' is not null or item ->> 'targetId' is not null then
          raise exception 'Invalid task parent';
        end if;
        select id into goal from public.goals
          where id=(item ->> 'goalId')::uuid and user_id=uid and status='active'
          and updated_at=(item ->> 'parentUpdatedAt')::timestamptz for share;
        if not found then raise exception 'Stale task parent' using errcode='40001'; end if;
      end if;
      if item ->> 'goalKey' is not null then
        goal := (linked ->> (item ->> 'goalKey'))::uuid;
        if goal is null then raise exception 'Select the linked Goal'; end if;
      end if;
      if item ->> 'targetId' is null then
        insert into public.tasks (user_id,goal_id,title,deadline,deadline_local,estimated_minutes,priority,status)
        values(uid,goal,item ->> 'title',((local_deadline+1)::timestamp at time zone tz)-interval '1 millisecond',
          local_deadline,(item ->> 'minutes')::integer,item ->> 'priority','pending');
      else
        update public.tasks set title=item ->> 'title',deadline_local=local_deadline,
          deadline=((local_deadline+1)::timestamp at time zone tz)-interval '1 millisecond',
          estimated_minutes=(item ->> 'minutes')::integer,priority=item ->> 'priority',
          goal_id=case when item ->> 'goalKey' is null then goal_id else goal end
          where id=(item ->> 'targetId')::uuid and user_id=uid and updated_at=(item ->> 'expectedUpdatedAt')::timestamptz
          and title=(item #>> '{before,title}') and priority=(item #>> '{before,priority}')
          and estimated_minutes is not distinct from (item #>> '{before,minutes}')::integer
          and coalesce(deadline_local,(deadline at time zone tz)::date) is not distinct from nullif(item #>> '{before,deadline}','')::date;
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception 'Stale task' using errcode='40001'; end if;
      end if;
    else
      raise exception 'Unknown draft item';
    end if;
  end loop;
  update public.v2_drafts set approved_at=clock_timestamp() where id=p_id and user_id=uid;
  return true;
end;
$$;

commit;
