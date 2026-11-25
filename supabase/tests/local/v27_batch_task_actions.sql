begin;

insert into auth.users(id,email) values
 ('fe279000-0000-4000-8000-000000000001','v27-batch-owner@example.test'),
 ('fe279000-0000-4000-8000-000000000002','v27-batch-other@example.test');
update public.profiles set timezone='Asia/Tokyo'
where id in ('fe279000-0000-4000-8000-000000000001','fe279000-0000-4000-8000-000000000002');
insert into public.tasks(id,user_id,title,priority,status,recurrence) values
 ('fe279001-0000-4000-8000-000000000001','fe279000-0000-4000-8000-000000000001','Single','medium','scheduled','once'),
 ('fe279001-0000-4000-8000-000000000002','fe279000-0000-4000-8000-000000000001','Repeat','medium','pending','daily'),
 ('fe279001-0000-4000-8000-000000000003','fe279000-0000-4000-8000-000000000001','Completed earlier','medium','completed','once'),
 ('fe279001-0000-4000-8000-000000000004','fe279000-0000-4000-8000-000000000002','Other completed','medium','completed','once');

insert into public.recommendation_results(user_id,local_date,target_kind,target_id,task_id,title,outcome) values
 ('fe279000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Tokyo')::date-1,'task',
  'fe279001-0000-4000-8000-000000000002','fe279001-0000-4000-8000-000000000002','Repeat','completed'),
 ('fe279000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Tokyo')::date-1,'task',
  'fe279001-0000-4000-8000-000000000003','fe279001-0000-4000-8000-000000000003','Completed earlier','completed');
insert into public.action_steps(id,user_id,task_id,title) values
 ('fe279002-0000-4000-8000-000000000001','fe279000-0000-4000-8000-000000000001',
  'fe279001-0000-4000-8000-000000000003','Associated step');
insert into public.daily_plans(id,user_id,plan_date,timezone) values
 ('fe279003-0000-4000-8000-000000000001','fe279000-0000-4000-8000-000000000001',current_date-1,'Asia/Tokyo');
insert into public.planned_actions(id,user_id,daily_plan_id,task_id,title,start_at,end_at,status) values
 ('fe279004-0000-4000-8000-000000000001','fe279000-0000-4000-8000-000000000001',
  'fe279003-0000-4000-8000-000000000001','fe279001-0000-4000-8000-000000000003',
  'V1 historical work',now()-interval '1 day',now()-interval '23 hours','completed');

set local role authenticated;
select set_config('request.jwt.claim.sub','fe279000-0000-4000-8000-000000000001',true);
do $$
declare
  day date := (statement_timestamp() at time zone 'Asia/Tokyo')::date;
  single_id uuid := 'fe279001-0000-4000-8000-000000000001';
  repeat_id uuid := 'fe279001-0000-4000-8000-000000000002';
  older_id uuid := 'fe279001-0000-4000-8000-000000000003';
  other_id uuid := 'fe279001-0000-4000-8000-000000000004';
  once_done jsonb := jsonb_build_object('kind','task','id',single_id,'expected','completed');
  repeat_done jsonb := jsonb_build_object('kind','task','id',repeat_id,'expected','completed');
  repeat_later jsonb := jsonb_build_object('kind','task','id',repeat_id,'expected','skipped');
  older_done jsonb := jsonb_build_object('kind','task','id',older_id,'expected','reopen');
begin
  perform public.record_recommendation_result(day,'task',single_id,'completed');
  perform public.record_recommendation_result(day,'task',repeat_id,'skipped');
  begin
    perform public.v27_undo_daily_results(day,jsonb_build_array(once_done,repeat_done));
    raise exception 'Stale result was accepted';
  exception when serialization_failure then null;
  end;
  if (select status from public.tasks where id=single_id) <> 'completed'
    or (select count(*) from public.recommendation_results where local_date=day) <> 2 then
    raise exception 'An earlier result in the failed batch was changed';
  end if;
  begin
    perform public.v27_delete_completed_tasks(array[single_id,repeat_id]);
    raise exception 'Pending task was accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.v27_delete_completed_tasks(array[single_id,other_id]);
    raise exception 'Other owner task was accepted';
  exception when serialization_failure then null;
  end;
  if not exists (select from public.tasks where id=single_id) then raise exception 'Partial deletion'; end if;

  begin
    perform public.v27_undo_daily_results(day-1,jsonb_build_array(repeat_done));
    raise exception 'Past record was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform public.v27_undo_daily_results(day,jsonb_build_array(once_done,repeat_later,older_done));
  perform public.v27_undo_daily_results(day,jsonb_build_array(once_done,repeat_later,older_done));
  if exists (select from public.recommendation_results where local_date=day)
     or (select status from public.tasks where id=single_id) <> 'scheduled'
     or (select status from public.tasks where id=repeat_id) <> 'pending'
     or (select status from public.tasks where id=older_id) <> 'pending' then
    raise exception 'Batch undo did not restore prior states';
  end if;

  perform public.record_recommendation_result(day,'task',repeat_id,'completed');
  perform public.record_recommendation_result(day,'task',single_id,'completed');
  perform public.v27_undo_daily_results(day,jsonb_build_array(repeat_done,once_done));
  if exists (select from public.recommendation_results where local_date=day) then
    raise exception 'Current date records were not undone';
  end if;

  perform public.record_recommendation_result(day,'task',single_id,'completed');
  perform public.record_recommendation_result(day,'task',older_id,'completed');
  perform public.v27_delete_completed_tasks(array[single_id,older_id]);
  if exists (select from public.tasks where id in (single_id,older_id))
     or exists (select from public.action_steps where task_id=older_id)
     or (select count(*) from public.recommendation_results where local_date=day-1) <> 2
     or (select count(*) from public.recommendation_results where local_date=day) <> 2
     or not exists (select from public.planned_actions where title='V1 historical work' and task_id is null) then
    raise exception 'Unexpected related data after deletion';
  end if;
end;
$$;
rollback;
