-- Local negative regression: run AFTER 5B, BEFORE the fix, with auth USAGE revoked.
-- The expected permission error is caught and verified; all fixtures roll back.
begin;
insert into auth.users(id,email) values('95000000-0000-4000-8000-000000000001','auth-regression@example.invalid');
insert into public.tasks(id,user_id,title,estimated_minutes,priority,status)
values('95000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000001','Regression',30,'high','pending');
insert into public.daily_plans(id,user_id,plan_date,timezone)
values('95000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000001',current_date,'Asia/Tokyo');
insert into public.planned_actions(id,user_id,daily_plan_id,task_id,title,start_at,end_at)
values('95000000-0000-4000-8000-000000000004','95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000002','Regression',now(),now()+interval '30 minutes');
select set_config('request.jwt.claim.sub','95000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $negative$
declare error_message text;
begin
  begin
    perform public.update_planned_action_status('95000000-0000-4000-8000-000000000004','completed');
    raise exception 'Original auth namespace bug was NOT reproduced';
  exception when insufficient_privilege then
    get stacked diagnostics error_message = message_text;
    if error_message not like '%permission denied for schema auth%' then
      raise exception 'Wrong negative-regression failure: %', error_message;
    end if;
  end;
  if (select status from public.planned_actions where id = '95000000-0000-4000-8000-000000000004') <> 'scheduled'
    or (select status from public.tasks where id = '95000000-0000-4000-8000-000000000002') <> 'pending'
    or exists(select 1 from public.activity_logs) then
    raise exception 'Original permission failure left partial state';
  end if;
end;
$negative$;
reset role;
rollback;
