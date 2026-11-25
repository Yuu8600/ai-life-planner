begin;

alter table public.v2_ai_usage add column calendar_thread_id uuid;

create function public.v27_reserve_calendar_ai(p_id uuid,p_user uuid,p_thread uuid,p_model text,p_amount integer)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not public.v2_reserve_ai(p_id,p_user,p_thread,p_model,p_amount,null) then return false; end if;
  update public.v2_ai_usage set calendar_thread_id=p_thread where id=p_id and user_id=p_user;
  return true;
end;
$$;

create function public.v27_approve_edited_draft(p_id uuid,p_revision uuid,p_selected text[],p_items jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare saved public.v2_drafts%rowtype;
begin
  select * into saved from public.v2_drafts where id=p_id and user_id=auth.uid() for update;
  if not found then raise exception 'Missing draft' using errcode='42501'; end if;
  if saved.approved_at is not null then return false; end if;
  return public.v2_approve_draft(p_id,public.v2_edit_draft(p_id,p_revision,p_items),p_selected);
end;
$$;

-- The private turn has no saved messages or draft. Materialize only the chosen policy fields.
create function public.v27_approve_calendar_policies(p_id uuid,p_thread uuid,p_policies jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  rev uuid;
  item jsonb;
  items jsonb := '[]';
  keys text[] := '{}';
  item_key text;
  kind text;
  start_day date;
  end_day date;
  task_id uuid;
  goal_id uuid;
begin
  perform 1 from public.v2_ai_usage where id=p_id and user_id=uid and calendar_thread_id=p_thread
    and result='success' for update;
  if not found then raise exception 'Missing private request' using errcode='42501'; end if;
  if exists (select 1 from public.v2_drafts where id=p_id and user_id=uid and thread_id=p_thread and approved_at is not null)
    then return false; end if;
  if jsonb_typeof(p_policies) is distinct from 'array' then raise exception 'Invalid policies'; end if;
  if jsonb_array_length(p_policies) not between 1 and 8 or octet_length(p_policies::text)>4096
    then raise exception 'Invalid policies'; end if;
  for item in select value from jsonb_array_elements(p_policies) loop
    if jsonb_typeof(item) is distinct from 'object' or
      item - array['policyKind','startDate','endDate','targetGoalId','targetTaskId'] <> '{}'::jsonb
      then raise exception 'Unexpected policy fields'; end if;
    kind := item->>'policyKind';
    if kind is null or kind not in ('focus_goal','focus_task','prefer_short','lighter_day')
      or coalesce(item->>'startDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or coalesce(item->>'endDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then raise exception 'Invalid policy'; end if;
    start_day := (item->>'startDate')::date;
    end_day := (item->>'endDate')::date;
    task_id := (item->>'targetTaskId')::uuid;
    goal_id := (item->>'targetGoalId')::uuid;
    if task_id is not null then
      perform 1 from public.tasks where id=task_id and user_id=uid and status not in ('completed','skipped') for share;
      if not found then raise exception 'Stale Task' using errcode='40001'; end if;
    end if;
    if goal_id is not null then
      perform 1 from public.goals where id=goal_id and user_id=uid and status='active' for share;
      if not found then raise exception 'Stale goal' using errcode='40001'; end if;
    end if;
    item_key := 'policy-' || (cardinality(keys)+1)::text;
    items := items || jsonb_build_array(jsonb_build_object(
      'key',item_key,'kind','policy','title',case kind
        when 'focus_goal' then '目標を優先'
        when 'focus_task' then 'タスクを優先'
        when 'prefer_short' then '短時間を優先'
        else '候補を絞る' end,
      'policyKind',kind,'startDate',start_day,'endDate',end_day,'targetGoalId',goal_id,'targetTaskId',task_id
    ));
    keys := array_append(keys,item_key);
  end loop;
  insert into public.v2_drafts(id,thread_id,user_id,items) values(p_id,p_thread,uid,items)
    returning revision into rev;
  return public.v2_approve_draft(p_id,rev,keys);
end;
$$;

revoke all on function public.v27_reserve_calendar_ai(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.v27_reserve_calendar_ai(uuid,uuid,uuid,text,integer) to service_role;
revoke all on function public.v27_approve_edited_draft(uuid,uuid,text[],jsonb),
  public.v27_approve_calendar_policies(uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.v27_approve_edited_draft(uuid,uuid,text[],jsonb),
  public.v27_approve_calendar_policies(uuid,uuid,jsonb) to authenticated;

commit;
