-- Run only on a fresh, isolated local rehearsal stack at the ten-migration baseline.
begin;
do $$
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 10
     or to_regclass('public.v2_plans') is not null then
    raise exception 'Expected the ten-migration legacy baseline';
  end if;
end $$;

insert into auth.users(id,email) values
 ('fe280001-0000-4000-8000-000000000001','legacy-a@example.test'),
 ('fe280001-0000-4000-8000-000000000002','legacy-b@example.test');
insert into public.goals(id,user_id,title,description,priority,status) values
 ('fe280002-0000-4000-8000-000000000001','fe280001-0000-4000-8000-000000000001','Legacy Goal','Keep this detail','medium','active');
insert into public.tasks(id,user_id,goal_id,title,estimated_minutes,status,deadline,priority) values
 ('fe280003-0000-4000-8000-000000000001','fe280001-0000-4000-8000-000000000001','fe280002-0000-4000-8000-000000000001','Legacy Task',35,'scheduled','2026-11-30T14:59:00Z','medium');
insert into public.daily_plans(id,user_id,plan_date,timezone,summary) values
 ('fe280004-0000-4000-8000-000000000001','fe280001-0000-4000-8000-000000000001','2026-11-10','Asia/Tokyo','Legacy Plan');
insert into public.planned_actions(id,user_id,daily_plan_id,task_id,title,start_at,end_at) values
 ('fe280005-0000-4000-8000-000000000001','fe280001-0000-4000-8000-000000000001','fe280004-0000-4000-8000-000000000001','fe280003-0000-4000-8000-000000000001','Legacy Action','2026-11-10T00:00:00Z','2026-11-10T00:35:00Z');
set local role authenticated;
select set_config('request.jwt.claim.sub','fe280001-0000-4000-8000-000000000001',true);
select public.update_planned_action_status('fe280005-0000-4000-8000-000000000001','completed');
commit;
