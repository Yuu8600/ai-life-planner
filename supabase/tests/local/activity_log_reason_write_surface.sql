-- Local reproduction of the superseded UPDATE(reason) workaround.
-- This proves the permission is a real client write surface, then rolls it back.
begin;
grant update (reason) on public.planned_actions to authenticated;
insert into auth.users(id,email) values('a1000000-0000-4000-8000-000000000001','reason-surface@example.invalid');
insert into public.daily_plans(id,user_id,plan_date,timezone)
values('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',current_date,'Asia/Tokyo');
insert into public.planned_actions(id,user_id,daily_plan_id,title,start_at,end_at,reason)
values('a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','Reason fixture',now(),now()+interval '30 minutes','Before');
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $reason_surface$
declare updated_reason text;
begin
  update public.planned_actions set reason = 'Client mutation'
  where id = 'a1000000-0000-4000-8000-000000000003' returning reason into updated_reason;
  if updated_reason is distinct from 'Client mutation' then raise exception 'Reason-write surface was not reproduced'; end if;
end;
$reason_surface$;
reset role;
rollback;
