begin;

insert into auth.users(id,email) values
 ('fe270000-0000-4000-8000-000000000001','v27-sql-owner@example.test'),
 ('fe270000-0000-4000-8000-000000000002','v27-sql-other@example.test');
insert into public.v2_threads(id,user_id,title) values
 ('fe270001-0000-4000-8000-000000000001','fe270000-0000-4000-8000-000000000001','予定の相談');
insert into public.tasks(id,user_id,title,priority,status,estimated_minutes) values
 ('fe270002-0000-4000-8000-000000000001','fe270000-0000-4000-8000-000000000001','レポート','medium','pending',30),
 ('fe270002-0000-4000-8000-000000000002','fe270000-0000-4000-8000-000000000002','別のユーザー','medium','pending',30);
insert into public.v2_drafts(id,thread_id,user_id,revision,items) values
 ('fe270003-0000-4000-8000-000000000001','fe270001-0000-4000-8000-000000000001','fe270000-0000-4000-8000-000000000001',
  'fe270004-0000-4000-8000-000000000001','[{"key":"edit","kind":"task","title":"旧下書き"}]');

set local role service_role;
do $$
declare u uuid := 'fe270000-0000-4000-8000-000000000001'; t uuid := 'fe270001-0000-4000-8000-000000000001';
  r uuid := 'fe270005-0000-4000-8000-000000000001';
begin
  if not public.v27_reserve_calendar_ai(r,u,t,'mock',1000) then raise exception 'Reservation failed'; end if;
  perform public.v2_finish_ai(r,u,t,'[v26:unsaved-calendar-response]','[]',100,5,2);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','fe270000-0000-4000-8000-000000000001',true);
do $$
declare
  u uuid := 'fe270000-0000-4000-8000-000000000001';
  t uuid := 'fe270001-0000-4000-8000-000000000001';
  r uuid := 'fe270005-0000-4000-8000-000000000001';
  task uuid := 'fe270002-0000-4000-8000-000000000001';
  d uuid := 'fe270003-0000-4000-8000-000000000001';
  rev uuid := 'fe270004-0000-4000-8000-000000000001';
  tomorrow date := current_date+1;
  p jsonb := jsonb_build_object('policyKind','focus_task','startDate',tomorrow,'endDate',tomorrow,'targetTaskId',task);
  revocable uuid;
  edited jsonb;
begin
  if exists (select 1 from public.v2_messages where thread_id=t)
    or exists (select 1 from public.v2_drafts where id=r) then raise exception 'Private turn persisted'; end if;
  begin
    perform public.v27_approve_calendar_policies(r,t,jsonb_build_array(p || '{"title":"Private calendar title"}'));
    raise exception 'Private field was allowed';
  exception when raise_exception then
    if sqlerrm <> 'Unexpected policy fields' then raise; end if;
  end;
  begin
    perform public.v27_approve_calendar_policies(r,t,jsonb_build_array(p || '{"targetTaskId":"fe270002-0000-4000-8000-000000000002"}'));
    raise exception 'Foreign target was allowed';
  exception when serialization_failure then null;
  end;
  perform set_config('request.jwt.claim.sub','fe270000-0000-4000-8000-000000000002',true);
  begin
    perform public.v27_approve_calendar_policies(r,t,jsonb_build_array(p));
    raise exception 'Used another account request';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',u::text,true);
  if not public.v27_approve_calendar_policies(r,t,jsonb_build_array(p))
    or public.v27_approve_calendar_policies(r,t,jsonb_build_array(p))
    then raise exception 'Private approval was not idempotent'; end if;
  if not exists (select from public.v2_drafts where id=r and approved_at is not null
    and jsonb_array_length(items)=1 and items->0->>'title'='タスクを優先')
    or exists (select from public.v2_messages where thread_id=t)
    then raise exception 'Unexpected saved data'; end if;
  select id into strict revocable from public.recommendation_policies where source_draft_id=r;
  perform public.v26_policy_status(revocable,1,false);
  begin
    perform public.v26_policy_status(revocable,1,true);
    raise exception 'Stale policy revision was accepted';
  exception when serialization_failure then null;
  end;
  perform public.v26_policy_status(revocable,2,true);
  edited := jsonb_build_array(jsonb_build_object(
    'key','edit','kind','task','title','編集後','targetId',task,
    'expectedUpdatedAt',(select updated_at from public.tasks where id=task),
    'patch',jsonb_build_object('title','編集後')));
  begin
    perform public.v27_approve_edited_draft(d,gen_random_uuid(),array['edit'],edited);
    raise exception 'Stale draft was accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.v27_approve_edited_draft(d,rev,array['missing'],edited);
    raise exception 'Missing selection was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid selection' then raise; end if;
  end;
  if (select revision from public.v2_drafts where id=d) <> rev then raise exception 'Failed approval saved edits'; end if;
  if not public.v27_approve_edited_draft(d,rev,array['edit'],edited)
    or public.v27_approve_edited_draft(d,rev,array['edit'],edited)
    then raise exception 'Edited approval was not idempotent'; end if;
  if (select title from public.tasks where id=task) <> '編集後' then raise exception 'Wrong edit applied'; end if;
  perform public.v26_undo_task_edit(d,task);
  if (select title from public.tasks where id=task) <> 'レポート' then raise exception 'Could not undo'; end if;
end $$;

rollback;
