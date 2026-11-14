begin;

create table public.v2_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create table public.v2_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null check (role in ('user','assistant')),
  body text not null check (length(btrim(body)) between 1 and 8000),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (thread_id,user_id) references public.v2_threads (id,user_id) on delete cascade
);
create index v2_messages_thread on public.v2_messages (thread_id,created_at,id);

create table public.v2_drafts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  user_id uuid not null references public.profiles on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 12),
  created_at timestamptz not null default clock_timestamp(),
  revision uuid not null default gen_random_uuid(),
  approved_at timestamptz,
  foreign key (thread_id,user_id) references public.v2_threads (id,user_id) on delete cascade
);
create index v2_drafts_thread on public.v2_drafts (thread_id,created_at);

create table public.v2_ai_usage (
  id uuid primary key,
  user_id uuid not null references public.profiles on delete cascade,
  model text not null,
  month date not null,
  reserved_micros integer not null check(reserved_micros >= 0),
  cost_micros integer check(cost_micros >= 0),
  input_tokens integer check(input_tokens >= 0),
  output_tokens integer check(output_tokens >= 0),
  result text not null default 'pending' check (result in ('pending','success','failed')),
  created_at timestamptz not null default clock_timestamp()
);
create index v2_ai_usage_month on public.v2_ai_usage (user_id,month);

alter table public.v2_threads enable row level security;
alter table public.v2_messages enable row level security;
alter table public.v2_drafts enable row level security;
alter table public.v2_ai_usage enable row level security;
revoke all on public.v2_threads,public.v2_messages,public.v2_drafts,public.v2_ai_usage from public,anon,authenticated,service_role;
grant select on public.v2_threads,public.v2_messages,public.v2_drafts,public.v2_ai_usage to authenticated;
grant insert (title) on public.v2_threads to authenticated;
grant select on public.v2_threads,public.v2_messages,public.v2_drafts,public.v2_ai_usage to service_role;
create policy v2_threads_read on public.v2_threads for select to authenticated using (user_id = (select auth.uid()));
create policy v2_threads_create on public.v2_threads for insert to authenticated with check (user_id = (select auth.uid()));
create policy v2_messages_read on public.v2_messages for select to authenticated using (user_id = (select auth.uid()));
create policy v2_drafts_read on public.v2_drafts for select to authenticated using (user_id = (select auth.uid()));
create policy v2_usage_read on public.v2_ai_usage for select to authenticated using (user_id = (select auth.uid()));

create function public.v2_ai_month_usage(p_month date) returns bigint
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(coalesce(cost_micros,reserved_micros)),0)
  from public.v2_ai_usage where user_id=auth.uid() and month=p_month
$$;
revoke all on function public.v2_ai_month_usage(date) from public,anon,authenticated,service_role;
grant execute on function public.v2_ai_month_usage(date) to authenticated;

create function public.v2_reserve_ai(p_id uuid,p_user uuid,p_thread uuid,p_model text,p_amount integer,p_prompt text)
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
  insert into public.v2_messages(thread_id,user_id,role,body) values(p_thread,p_user,'user',p_prompt);
  return true;
end;
$$;

create function public.v2_finish_ai(p_id uuid,p_user uuid,p_thread uuid,p_reply text,p_items jsonb,
  p_cost integer,p_input integer,p_output integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.v2_ai_usage set result = case when p_reply is null then 'failed' else 'success' end,
    cost_micros = p_cost,input_tokens=p_input,output_tokens=p_output
  where id=p_id and user_id=p_user and result='pending';
  if not found then return; end if;
  if p_reply is not null then
    insert into public.v2_messages(thread_id,user_id,role,body) values(p_thread,p_user,'assistant',p_reply);
    if jsonb_typeof(p_items)='array' and jsonb_array_length(p_items)>0 then
      insert into public.v2_drafts(thread_id,user_id,items) values(p_thread,p_user,p_items);
    end if;
  end if;
end;
$$;
revoke all on function public.v2_reserve_ai(uuid,uuid,uuid,text,integer,text),
  public.v2_finish_ai(uuid,uuid,uuid,text,jsonb,integer,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.v2_reserve_ai(uuid,uuid,uuid,text,integer,text),
  public.v2_finish_ai(uuid,uuid,uuid,text,jsonb,integer,integer,integer) to service_role;

create function public.v2_edit_draft(p_id uuid,p_revision uuid,p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare next_revision uuid := gen_random_uuid();
begin
  update public.v2_drafts set items=p_items,revision=next_revision
    where id=p_id and user_id=auth.uid() and revision=p_revision and approved_at is null;
  if not found then raise exception 'Stale draft' using errcode='40001'; end if;
  return next_revision;
end;
$$;

create function public.v2_approve_draft(p_id uuid,p_revision uuid,p_selected text[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  draft public.v2_drafts%rowtype;
  item jsonb;
  key text;
  goal uuid;
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
    order by case when value ->> 'kind'='goal' then 0 else 1 end loop
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
    elsif item ->> 'kind'='task' then
      goal := null;
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
          and estimated_minutes=(item #>> '{before,minutes}')::integer
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
revoke all on function public.v2_edit_draft(uuid,uuid,jsonb),
  public.v2_approve_draft(uuid,uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function public.v2_edit_draft(uuid,uuid,jsonb),
  public.v2_approve_draft(uuid,uuid,text[]) to authenticated;
commit;
