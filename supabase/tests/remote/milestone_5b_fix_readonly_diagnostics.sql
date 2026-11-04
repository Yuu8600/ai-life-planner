-- Read-only catalog / cleanup report after the permission fix. No user content.
with fixture_owner(id) as (values
  ('61000000-0000-4000-8000-000000000001'::uuid),('61000000-0000-4000-8000-000000000002'::uuid),
  ('71000000-0000-4000-8000-000000000001'::uuid),('71000000-0000-4000-8000-000000000002'::uuid),
  ('81000000-0000-4000-8000-000000000001'::uuid),('81000000-0000-4000-8000-000000000002'::uuid),
  ('91000000-0000-4000-8000-000000000001'::uuid),('91000000-0000-4000-8000-000000000002'::uuid)
), helper as (
  select lower(prosrc) as body from pg_proc
  where oid = 'planner_execution_private.apply_transition(uuid,text)'::regprocedure
), lock_positions as (
  select position('perform 1 from public.daily_plans' in body) as plan_lock,
    position('select action.id, action.task_id, action.status into action_record' in body) as action_lock,
    position('perform 1 from public.tasks' in body) as task_lock,
    position('if action_record.status = p_target_status' in body) as status_check
  from helper
)
select
  has_table_privilege('authenticated','public.planned_actions','SELECT') as authenticated_select,
  has_table_privilege('authenticated','public.planned_actions','INSERT') as authenticated_insert,
  has_table_privilege('authenticated','public.planned_actions','DELETE') as authenticated_delete,
  has_table_privilege('authenticated','public.planned_actions','UPDATE') as authenticated_table_update,
  has_any_column_privilege('authenticated','public.planned_actions','UPDATE') as authenticated_any_column_update,
  has_column_privilege('authenticated','public.planned_actions','status','UPDATE') as authenticated_status_update,
  has_column_privilege('authenticated','public.planned_actions','reason','UPDATE') as authenticated_reason_update,
  (select coalesce(jsonb_agg(attname order by attnum),'[]'::jsonb) from pg_attribute
    where attrelid='public.planned_actions'::regclass and attnum>0 and not attisdropped
      and has_column_privilege('authenticated',attrelid,attnum,'UPDATE')) as authenticated_update_columns,
  (select not prosecdef and position('auth.uid()' in prosrc)>0 and position('for update' in lower(prosrc))=0
    from pg_proc where oid='public.update_planned_action_status(uuid,text)'::regprocedure) as public_invoker_auth_no_locks,
  (select plan_lock>0 and action_lock>plan_lock and task_lock>action_lock and status_check>action_lock
    from lock_positions) as private_plan_action_task_order_and_locked_status,
  (select prosecdef and proowner='ai_life_planner_execution_writer'::regrole
    from pg_proc where oid='planner_execution_private.apply_transition(uuid,text)'::regprocedure) as private_restricted_definer_owner,
  (select not prosecdef and prosqlbody is not null
    from pg_proc where oid='planner_execution_private.actor_id()'::regprocedure) as actor_prebound_invoker,
  (select prosecdef and proowner='ai_life_planner_activity_writer'::regrole and position('auth.' in prosrc)=0
    from pg_proc where oid='public.record_planned_action_execution()'::regprocedure) as logger_definer_owner_no_auth,
  (select proconfig from pg_proc where oid='public.record_planned_action_execution()'::regprocedure) as logger_config,
  not has_function_privilege('authenticated','public.record_planned_action_execution()','EXECUTE') as logger_client_execute_denied,
  (select not rolcanlogin and not rolsuper and not rolbypassrls from pg_roles where rolname='ai_life_planner_activity_writer') as logger_role_restricted,
  (select not rolcanlogin and not rolsuper and not rolbypassrls from pg_roles where rolname='ai_life_planner_execution_writer') as executor_role_restricted,
  has_schema_privilege('ai_life_planner_activity_writer','auth','USAGE') as logger_auth_usage,
  has_schema_privilege('ai_life_planner_execution_writer','auth','USAGE') as executor_auth_usage,
  not exists(select 1 from pg_policies where policyname in ('daily_plans_activity_writer_select','activity_logs_writer_insert')
    and (coalesce(qual,'')||coalesce(with_check,'')) like '%auth.%') as logger_policies_no_auth,
  (select count(*) from auth.users where id in (select id from fixture_owner)) as fixture_users,
  (select count(*) from public.profiles where id in (select id from fixture_owner)) as fixture_profiles,
  (select count(*) from public.tasks where user_id in (select id from fixture_owner)) as fixture_tasks,
  (select count(*) from public.daily_plans where user_id in (select id from fixture_owner)) as fixture_plans,
  (select count(*) from public.planned_actions where user_id in (select id from fixture_owner)) as fixture_actions,
  (select count(*) from public.activity_logs where user_id in (select id from fixture_owner)) as fixture_logs,
  not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('m5a_fail_task_update','m5b_fail_task_update','m5b_fail_log_insert')) as verification_functions_removed,
  not exists(select 1 from pg_trigger where tgname in ('m5a_fail_task_update','m5b_fail_task_update','m5b_fail_log_insert')
    and not tgisinternal) as verification_triggers_removed;
