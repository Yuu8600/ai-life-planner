begin;

alter table public.v2_drafts add column rejected_at timestamptz, add column applied_keys text[];
create table public.recommendation_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_kind text not null check (policy_kind in ('focus_goal','focus_task','prefer_short','lighter_day')),
  start_date date not null,
  end_date date not null check (end_date - start_date between 0 and 13),
  target_goal_id uuid,
  target_task_id uuid,
  source text not null default 'ai' check (source in ('ai','manual')),
  source_draft_id uuid references public.v2_drafts(id) on delete set null,
  draft_key text,
  status text not null default 'active' check (status in ('active','revoked')),
  revision integer not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  unique(source_draft_id,draft_key),
  foreign key (target_goal_id,user_id) references public.goals(id,user_id) on delete cascade,
  foreign key (target_task_id,user_id) references public.tasks(id,user_id) on delete cascade,
  check (num_nonnulls(target_goal_id,target_task_id) <= 1),
  check (case policy_kind when 'focus_goal' then target_goal_id is not null
    when 'focus_task' then target_task_id is not null
    when 'lighter_day' then start_date=end_date and num_nonnulls(target_goal_id,target_task_id)=0
    else true end)
);
create index recommendation_policies_current on public.recommendation_policies(user_id,status,start_date,end_date);

create table public.v26_task_edit_receipts (
  draft_id uuid not null references public.v2_drafts(id) on delete cascade,
  task_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  before_values jsonb not null,
  applied_revision timestamptz not null,
  undone_at timestamptz,
  primary key(draft_id,task_id)
);
alter table public.recommendation_policies enable row level security;
alter table public.v26_task_edit_receipts enable row level security;
revoke all on public.recommendation_policies,public.v26_task_edit_receipts from public,anon,authenticated;
grant select on public.recommendation_policies to authenticated;
grant select(draft_id,task_id,undone_at) on public.v26_task_edit_receipts to authenticated;
create policy policies_read_own on public.recommendation_policies for select to authenticated using (user_id=(select auth.uid()));
create policy edit_receipts_read_own on public.v26_task_edit_receipts for select to authenticated using (user_id=(select auth.uid()));

create function public.v26_policy_status(p_id uuid,p_revision integer,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_active is null then raise exception 'Missing status'; end if;
  update public.recommendation_policies set status=case when p_active then 'active' else 'revoked' end,revision=revision+1
    where id=p_id and user_id=auth.uid() and revision=p_revision;
  if not found then raise exception 'Policy changed' using errcode='40001'; end if;
end;
$$;

create function public.v26_reject_draft(p_id uuid,p_revision uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.v2_drafts set rejected_at=clock_timestamp(),revision=gen_random_uuid()
    where id=p_id and user_id=auth.uid() and revision=p_revision and approved_at is null and rejected_at is null;
  if not found then raise exception 'Draft changed' using errcode='40001'; end if;
end;
$$;

create function public.v26_undo_task_edit(p_draft uuid,p_task uuid)
returns void language plpgsql security definer set search_path='' as $$
declare receipt public.v26_task_edit_receipts%rowtype; old public.tasks%rowtype;
begin
  select * into receipt from public.v26_task_edit_receipts where draft_id=p_draft and task_id=p_task
    and user_id=auth.uid() for update;
  if not found then raise exception 'Missing change' using errcode='42501'; end if;
  if receipt.undone_at is not null then return; end if;
  old := jsonb_populate_record(null::public.tasks,receipt.before_values);
  update public.tasks set title=old.title,priority=old.priority,goal_id=old.goal_id,
    deadline=old.deadline,deadline_local=old.deadline_local,estimated_minutes=old.estimated_minutes,
    recurrence=old.recurrence,recurrence_days=old.recurrence_days
    where id=p_task and user_id=auth.uid() and updated_at=receipt.applied_revision;
  if not found then raise exception 'Task changed after approval' using errcode='40001'; end if;
  update public.v26_task_edit_receipts set undone_at=clock_timestamp() where draft_id=p_draft and task_id=p_task;
end;
$$;

create or replace function public.v2_edit_draft(p_id uuid,p_revision uuid,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare next_revision uuid := gen_random_uuid();
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>8 or
    octet_length(p_items::text)>32000 then raise exception 'Invalid draft items'; end if;
  update public.v2_drafts set items=p_items,revision=next_revision
    where id=p_id and user_id=auth.uid() and revision=p_revision and approved_at is null and rejected_at is null;
  if not found then raise exception 'Stale draft' using errcode='40001'; end if;
  return next_revision;
end;
$$;

create or replace function public.v2_approve_draft(p_id uuid,p_revision uuid,p_selected text[])
returns boolean language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  draft public.v2_drafts%rowtype;
  old public.tasks%rowtype;
  item jsonb;
  fields jsonb;
  goal uuid;
  parent_task uuid;
  task_id uuid;
  local_deadline date;
  days smallint[];
  kind text;
  tz text;
  saved_revision timestamptz;
begin
  select * into draft from public.v2_drafts where id=p_id and user_id=uid for update;
  if not found then raise exception 'Missing draft' using errcode='42501'; end if;
  if draft.approved_at is not null then return false; end if;
  if draft.rejected_at is not null or draft.revision is distinct from p_revision then
    raise exception 'Stale draft' using errcode='40001';
  end if;
  if coalesce(cardinality(p_selected),0) not between 1 and 8 or array_position(p_selected,null) is not null
    or (select count(distinct x) from unnest(p_selected) x) <> cardinality(p_selected)
    or (select count(*) from jsonb_array_elements(draft.items) i where i ->> 'key'=any(p_selected)) <> cardinality(p_selected) then
    raise exception 'Invalid selection';
  end if;
  select timezone into tz from public.profiles where id=uid;
  for item in select value from jsonb_array_elements(draft.items)
    where value ->> 'key'=any(p_selected)
    order by case value ->> 'kind' when 'step' then 0 else 1 end loop
    kind := item ->> 'kind';

    if kind='policy' then
      if (item ->> 'endDate')::date < (statement_timestamp() at time zone tz)::date then
        raise exception 'Policy already expired' using errcode='40001';
      end if;
      insert into public.recommendation_policies(user_id,policy_kind,start_date,end_date,target_goal_id,target_task_id,source_draft_id,draft_key)
        values(uid,item->>'policyKind',(item->>'startDate')::date,(item->>'endDate')::date,
          (item->>'targetGoalId')::uuid,(item->>'targetTaskId')::uuid,p_id,item->>'key');
    elsif kind='step' then
      select id into parent_task from public.tasks where id=(item->>'taskId')::uuid and user_id=uid
        and status not in ('completed','skipped') and updated_at=(item->>'parentUpdatedAt')::timestamptz for share;
      if not found then raise exception 'Stale step parent' using errcode='40001'; end if;
      insert into public.action_steps(user_id,task_id,title,estimated_minutes)
        values(uid,parent_task,item->>'title',(item->>'minutes')::integer);
    elsif kind='task' and item->>'goalKey' is null then
      task_id := (item->>'targetId')::uuid;
      fields := coalesce(item->'patch',item);
      if jsonb_typeof(fields)<>'object' or (item ? 'patch' and fields - array['title','priority','deadline','minutes','goalId','recurrence','weekdays'] <> '{}'::jsonb) then
        raise exception 'Invalid Task fields';
      end if;
      if fields ? 'title' and (fields->>'title' is null or length(btrim(fields->>'title')) not between 1 and 200) then
        raise exception 'Invalid Task title';
      end if;
      local_deadline := (fields->>'deadline')::date;
      goal := (fields->>'goalId')::uuid;
      if goal is not null then
        perform 1 from public.goals where id=goal and user_id=uid and status='active'
          and (item->>'parentUpdatedAt' is null or updated_at=(item->>'parentUpdatedAt')::timestamptz) for share;
        if not found then raise exception 'Stale Task goal' using errcode='40001'; end if;
      end if;
      days := array(select jsonb_array_elements_text(coalesce(fields->'weekdays','[]'))::smallint);
      if task_id is null then
        insert into public.tasks(user_id,goal_id,title,deadline,deadline_local,estimated_minutes,priority,status,recurrence,recurrence_days)
          values(uid,goal,fields->>'title',((local_deadline+1)::timestamp at time zone tz)-interval '1 millisecond',
            local_deadline,(fields->>'minutes')::integer,coalesce(fields->>'priority','medium'),'pending',
            coalesce(fields->>'recurrence','once'),days);
      else
        select * into old from public.tasks where id=task_id and user_id=uid
          and updated_at=(item->>'expectedUpdatedAt')::timestamptz for update;
        if not found then raise exception 'Stale Task' using errcode='40001'; end if;
        update public.tasks set
          title=case when fields ? 'title' then fields->>'title' else old.title end,
          priority=case when fields ? 'priority' then fields->>'priority' else old.priority end,
          estimated_minutes=case when fields ? 'minutes' then (fields->>'minutes')::integer else old.estimated_minutes end,
          goal_id=case when item ? 'patch' and fields ? 'goalId' then goal else old.goal_id end,
          deadline=case when fields ? 'deadline' then ((local_deadline+1)::timestamp at time zone tz)-interval '1 millisecond' else old.deadline end,
          deadline_local=case when fields ? 'deadline' then local_deadline else old.deadline_local end,
          recurrence=coalesce(fields->>'recurrence',old.recurrence),
          recurrence_days=case when fields ? 'weekdays' then days else old.recurrence_days end
          where id=task_id and user_id=uid returning updated_at into saved_revision;
        insert into public.v26_task_edit_receipts values(p_id,task_id,uid,to_jsonb(old),saved_revision,null);
      end if;
    else
      raise exception 'Unsupported draft item';
    end if;
  end loop;
  update public.v2_drafts set approved_at=clock_timestamp(),applied_keys=p_selected where id=p_id and user_id=uid;
  return true;
end;
$$;

revoke all on function public.v26_policy_status(uuid,integer,boolean),public.v26_reject_draft(uuid,uuid),
  public.v26_undo_task_edit(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.v26_policy_status(uuid,integer,boolean),public.v26_reject_draft(uuid,uuid),
  public.v26_undo_task_edit(uuid,uuid) to authenticated;

create or replace function public.v2_reserve_ai(p_id uuid,p_user uuid,p_thread uuid,p_model text,p_amount integer,p_prompt text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  billing_month date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  if p_amount <= 0 or p_amount > 500000 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 3));
  if not exists (select 1 from public.v2_threads where id = p_thread and user_id = p_user) then
    raise exception 'Missing thread' using errcode = '42501';
  end if;
  if exists (select 1 from public.v2_ai_usage where user_id = p_user and result = 'pending'
    and created_at > now() - interval '2 minutes') then
    raise exception 'Request in progress' using errcode = '55000';
  end if;
  if coalesce((select sum(coalesce(cost_micros,reserved_micros))
      from public.v2_ai_usage where user_id=p_user and month=billing_month),0) + p_amount > 500000 then
    return false;
  end if;
  insert into public.v2_ai_usage(id,user_id,model,month,reserved_micros) values(p_id,p_user,p_model,billing_month,p_amount);
  if p_prompt is not null then
    insert into public.v2_messages(thread_id,user_id,role,body) values(p_thread,p_user,'user',p_prompt);
  end if;
  return true;
end;
$$;

create or replace function public.v2_finish_ai(p_id uuid,p_user uuid,p_thread uuid,p_reply text,p_items jsonb,
  p_cost integer,p_input integer,p_output integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.v2_ai_usage set result = case when p_reply is null then 'failed' else 'success' end,
    cost_micros = p_cost,input_tokens=p_input,output_tokens=p_output
  where id=p_id and user_id=p_user and result='pending';
  if not found then return; end if;
  if p_reply is not null and p_reply <> '[v26:unsaved-calendar-response]' then
    insert into public.v2_messages(thread_id,user_id,role,body) values(p_thread,p_user,'assistant',p_reply);
    if jsonb_typeof(p_items)='array' and jsonb_array_length(p_items)>0 then
      insert into public.v2_drafts(thread_id,user_id,items) values(p_thread,p_user,p_items);
    end if;
  end if;
end;
$$;

commit;
