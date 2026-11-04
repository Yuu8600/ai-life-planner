-- Catalog and fixture-only counts; never return existing user content.
with owners(id) as (values
 ('61000000-0000-4000-8000-000000000001'::uuid),('61000000-0000-4000-8000-000000000002'::uuid),
 ('71000000-0000-4000-8000-000000000001'::uuid),('71000000-0000-4000-8000-000000000002'::uuid),
 ('81000000-0000-4000-8000-000000000001'::uuid),('81000000-0000-4000-8000-000000000002'::uuid),
 ('91000000-0000-4000-8000-000000000001'::uuid),('91000000-0000-4000-8000-000000000002'::uuid),
 ('a1000000-0000-4000-8000-000000000001'::uuid),('a1000000-0000-4000-8000-000000000002'::uuid),
 ('b1000000-0000-4000-8000-000000000001'::uuid)
), helper as (
 select lower(prosrc) as body from pg_proc
 where oid='planner_execution_private.lock_replan_if_current(date,jsonb,jsonb)'::regprocedure
), positions as (
 select position('select plan.id into plan_id' in body) as plan_lock,
 position('perform action.id' in body) as action_lock,
 position('p_expected_snapshot is distinct' in body) as snapshot_check,
 position('perform task.id' in body) as task_lock,
 position('task.status <> ''pending''' in body) as task_check,
 position('clock_timestamp()' in body) as time_check from helper
)
select
 has_table_privilege('authenticated','public.planned_actions','SELECT') as action_select,
 has_table_privilege('authenticated','public.planned_actions','INSERT') as action_insert,
 has_table_privilege('authenticated','public.planned_actions','DELETE') as action_delete,
 has_any_column_privilege('authenticated','public.planned_actions','UPDATE') as action_any_update,
 has_column_privilege('authenticated','public.planned_actions','status','UPDATE') as action_status_update,
 has_column_privilege('authenticated','public.planned_actions','reason','UPDATE') as action_reason_update,
 (select coalesce(jsonb_agg(attname order by attnum),'[]'::jsonb) from pg_attribute
 where attrelid='public.planned_actions'::regclass and attnum>0 and not attisdropped
 and has_column_privilege('authenticated',attrelid,attnum,'UPDATE')) as action_update_columns,
 (select not prosecdef and position('auth.uid()' in prosrc)>0
 and position('p_expected_snapshot' in prosrc)>0 from pg_proc
 where oid='public.replace_daily_plan_if_current(date,text,text,jsonb,jsonb)'::regprocedure) as guarded_public_invoker_auth,
 (select not prosecdef and prosqlbody is not null from pg_proc
 where oid='public.get_daily_plan_snapshot(date)'::regprocedure) as snapshot_public_invoker,
 (select not prosecdef and prosqlbody is not null from pg_proc
 where oid='planner_execution_private.plan_snapshot(date)'::regprocedure) as snapshot_prebound_invoker,
 (select bool_and(proargnames is null or not ('p_user_id'=any(proargnames))) from pg_proc
 where oid in ('public.get_daily_plan_snapshot(date)'::regprocedure,
 'public.replace_daily_plan_if_current(date,text,text,jsonb,jsonb)'::regprocedure)) as no_owner_argument,
 (select prosecdef and proowner='ai_life_planner_execution_writer'::regrole and proconfig=array['search_path=""']
 from pg_proc where oid='planner_execution_private.lock_replan_if_current(date,jsonb,jsonb)'::regprocedure) as private_restricted_definer,
 (select not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole
 from pg_roles where rolname='ai_life_planner_execution_writer') as writer_restricted,
 has_schema_privilege('ai_life_planner_execution_writer','auth','USAGE') as writer_auth_usage,
 has_schema_privilege('ai_life_planner_execution_writer','planner_execution_private','CREATE') as writer_schema_create,
 has_function_privilege('authenticated','planner_execution_private.lock_replan_if_current(date,jsonb,jsonb)','EXECUTE') as private_invoker_delegation_execute,
 has_function_privilege('anon','planner_execution_private.lock_replan_if_current(date,jsonb,jsonb)','EXECUTE') as private_anon_execute,
 to_regprocedure('public.lock_replan_if_current(date,jsonb,jsonb)') is null as no_public_helper,
 (select plan_lock>0 and action_lock>plan_lock and task_lock>action_lock
 and snapshot_check>action_lock and task_check>task_lock and time_check>task_check from positions) as lock_order_and_fresh_checks,
 (select count(*) from auth.users where id in (select id from owners)) as fixture_users,
 (select count(*) from public.profiles where id in (select id from owners)) as fixture_profiles,
 (select count(*) from public.tasks where user_id in (select id from owners)) as fixture_tasks,
 (select count(*) from public.daily_plans where user_id in (select id from owners)) as fixture_plans,
 (select count(*) from public.planned_actions where user_id in (select id from owners)) as fixture_actions,
 (select count(*) from public.activity_logs where user_id in (select id from owners)) as fixture_logs,
 not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('m5a_fail_task_update','m5b_fail_task_update','m5b_fail_log_insert')) as verification_functions_removed,
 not exists(select 1 from pg_trigger where not tgisinternal
 and tgname in ('m5a_fail_task_update','m5b_fail_task_update','m5b_fail_log_insert')) as verification_triggers_removed;
