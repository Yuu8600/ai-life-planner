begin;

insert into auth.users(id,email) values
 ('fe260000-0000-4000-8000-000000000001','v26-a@example.test'),
 ('fe260000-0000-4000-8000-000000000002','v26-b@example.test');
update public.profiles set timezone='Asia/Tokyo'
where id in ('fe260000-0000-4000-8000-000000000001','fe260000-0000-4000-8000-000000000002');
insert into public.tasks(id,user_id,title,priority,status,estimated_minutes) values
 ('fe260001-0000-4000-8000-000000000001','fe260000-0000-4000-8000-000000000001','Report','medium','pending',40),
 ('fe260001-0000-4000-8000-000000000002','fe260000-0000-4000-8000-000000000002','Other task','high','pending',50);
insert into public.v2_threads(id,user_id,title) values
 ('fe260002-0000-4000-8000-000000000001','fe260000-0000-4000-8000-000000000001','QA');
insert into public.v2_drafts(id,thread_id,user_id,revision,items)
select 'fe260003-0000-4000-8000-000000000001','fe260002-0000-4000-8000-000000000001',
 task.user_id,'fe260004-0000-4000-8000-000000000001',jsonb_build_array(
   jsonb_build_object('key','task','kind','task','targetId',task.id,'expectedUpdatedAt',task.updated_at,'patch',jsonb_build_object('minutes',15)),
   jsonb_build_object('key','policy','kind','policy','policyKind','focus_task','startDate',(now() at time zone 'Asia/Tokyo')::date,
     'endDate',(now() at time zone 'Asia/Tokyo')::date+6,'targetTaskId',task.id),
   jsonb_build_object('key','step','kind','step','title','Read notes','taskId',task.id,'parentUpdatedAt',task.updated_at),
   jsonb_build_object('key','new','kind','task','patch',jsonb_build_object('title','New task','recurrence','weekly','weekdays',jsonb_build_array(1,3))),
   jsonb_build_object('key','old','kind','goal','title','Legacy proposal','priority','medium')
 ) from public.tasks task where task.id='fe260001-0000-4000-8000-000000000001';
insert into public.v2_drafts(id,thread_id,user_id,revision,items) values
 ('fe260003-0000-4000-8000-000000000002','fe260002-0000-4000-8000-000000000001','fe260000-0000-4000-8000-000000000001',
  'fe260004-0000-4000-8000-000000000002','[{"key":"task","kind":"task","patch":{"title":"Rejected task"}}]'),
 ('fe260003-0000-4000-8000-000000000003','fe260002-0000-4000-8000-000000000001','fe260000-0000-4000-8000-000000000001',
  'fe260004-0000-4000-8000-000000000003','[{"key":"task","kind":"task","targetId":"fe260001-0000-4000-8000-000000000001","expectedUpdatedAt":"2000-01-01","patch":{"title":"Stale"}}]'),
 ('fe260003-0000-4000-8000-000000000004','fe260002-0000-4000-8000-000000000001','fe260000-0000-4000-8000-000000000001',
  'fe260004-0000-4000-8000-000000000004',jsonb_build_array(jsonb_build_object(
    'key','policy','kind','policy','policyKind','focus_task','startDate',(now() at time zone 'Asia/Tokyo')::date,
    'endDate',(now() at time zone 'Asia/Tokyo')::date,'targetTaskId','fe260001-0000-4000-8000-000000000002')));

set local role authenticated;
select set_config('request.jwt.claim.sub','fe260000-0000-4000-8000-000000000001',true);
do $$
declare
  draft uuid := 'fe260003-0000-4000-8000-000000000001';
  rev uuid := 'fe260004-0000-4000-8000-000000000001';
  task uuid := 'fe260001-0000-4000-8000-000000000001';
  policy uuid;
begin
  if exists (select 1 from public.recommendation_policies) then raise exception 'Unapproved policy persisted'; end if;
  begin
    perform public.v2_approve_draft(draft,rev,array['old']);
    raise exception 'Legacy Goal approval was allowed';
  exception when raise_exception then
    if sqlerrm <> 'Unsupported draft item' then raise; end if;
  end;
  begin
    perform public.v2_approve_draft('fe260003-0000-4000-8000-000000000003','fe260004-0000-4000-8000-000000000003',array['task']);
    raise exception 'Stale Task was allowed';
  exception when serialization_failure then null;
  end;
  begin
    perform public.v2_approve_draft('fe260003-0000-4000-8000-000000000004','fe260004-0000-4000-8000-000000000004',array['policy']);
    raise exception 'Foreign target was allowed';
  exception when foreign_key_violation then null;
  end;
  if not public.v2_approve_draft(draft,rev,array['task','policy','step','new']) then raise exception 'Approval failed'; end if;
  if public.v2_approve_draft(draft,rev,array['task','policy','step','new']) then raise exception 'Duplicate approval'; end if;
  if not exists (select from public.v2_drafts where id=draft and applied_keys=array['task','policy','step','new']) then
    raise exception 'Selected items were not recorded';
  end if;
  if not exists (select from public.tasks where id=task and estimated_minutes=15 and title='Report' and status='pending' and priority='medium')
    or not exists (select from public.tasks where title='New task' and recurrence_days='{1,3}' and estimated_minutes is null)
    or not exists (select from public.action_steps where task_id=task and title='Read notes') then raise exception 'Wrong Task result'; end if;
  select id into strict policy from public.recommendation_policies where target_task_id=task;
  perform public.v26_policy_status(policy,1,false);
  perform public.v26_policy_status(policy,2,true);
  perform public.v26_undo_task_edit(draft,task);
  perform public.v26_undo_task_edit(draft,task);
  if (select estimated_minutes from public.tasks where id=task) <> 40 then raise exception 'Undo did not restore Task'; end if;
  perform public.v26_reject_draft('fe260003-0000-4000-8000-000000000002','fe260004-0000-4000-8000-000000000002');
  begin
    perform public.v2_approve_draft('fe260003-0000-4000-8000-000000000002','fe260004-0000-4000-8000-000000000002',array['task']);
    raise exception 'Rejected draft was applied';
  exception when serialization_failure then null;
  end;
  perform set_config('request.jwt.claim.sub','fe260000-0000-4000-8000-000000000002',true);
  if exists(select 1 from public.recommendation_policies) then raise exception 'Policy visible to another user'; end if;
end $$;
reset role;
do $$
declare u uuid := 'fe260000-0000-4000-8000-000000000001'; t uuid := 'fe260002-0000-4000-8000-000000000001';
  r uuid := 'fe260005-0000-4000-8000-000000000001';
begin
  if not public.v2_reserve_ai(r,u,t,'mock',1000,null) then raise exception 'Private request not reserved'; end if;
  perform public.v2_finish_ai(r,u,t,'[v26:unsaved-calendar-response]','[]',100,5,2);
  if exists(select from public.v2_messages where user_id=u)
    or (select result from public.v2_ai_usage where id=r) <> 'success' then
    raise exception 'Private prompt persisted or budget not finalized';
  end if;
end $$;
rollback;
