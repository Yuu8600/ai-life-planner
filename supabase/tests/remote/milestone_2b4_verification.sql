-- Remote-only Milestone 2B-4 verification.
-- Run only after applying 20260913201453_create_daily_plans_and_planned_actions.sql.
-- All fixture writes occur inside this transaction and are rolled back.

begin;

set local statement_timeout = '30s';

do $catalog$
declare
  target_table_name text;
  target_index_name text;
begin
  foreach target_table_name in array array['daily_plans', 'planned_actions']
  loop
    if not exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = target_table_name
        and relation.relkind = 'r'
        and relation.relrowsecurity
    ) then
      raise exception 'Milestone 2B-4 verification failed: public.% is missing or RLS is disabled',
        target_table_name;
    end if;

    if (
      select count(*)
      from pg_policies as policy_info
      where policy_info.schemaname = 'public'
        and policy_info.tablename = target_table_name
        and policy_info.roles = array['authenticated']::name[]
        and policy_info.cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        and policy_info.policyname in (
          target_table_name || '_select_own',
          target_table_name || '_insert_own',
          target_table_name || '_update_own',
          target_table_name || '_delete_own'
        )
    ) <> 4 then
      raise exception 'Milestone 2B-4 verification failed: public.% policies differ',
        target_table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', target_table_name), 'SELECT')
      or has_table_privilege('anon', format('public.%I', target_table_name), 'INSERT')
      or has_table_privilege('anon', format('public.%I', target_table_name), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', target_table_name), 'DELETE')
      or has_table_privilege('anon', format('public.%I', target_table_name), 'TRUNCATE')
      or has_table_privilege('anon', format('public.%I', target_table_name), 'REFERENCES')
      or has_table_privilege('anon', format('public.%I', target_table_name), 'TRIGGER') then
      raise exception 'Milestone 2B-4 verification failed: anon has privileges on public.%',
        target_table_name;
    end if;

    if not (
      has_table_privilege('authenticated', format('public.%I', target_table_name), 'SELECT')
      and has_table_privilege('authenticated', format('public.%I', target_table_name), 'INSERT')
      and has_table_privilege('authenticated', format('public.%I', target_table_name), 'UPDATE')
      and has_table_privilege('authenticated', format('public.%I', target_table_name), 'DELETE')
    ) then
      raise exception 'Milestone 2B-4 verification failed: authenticated CRUD grants missing on public.%',
        target_table_name;
    end if;

    if has_table_privilege('authenticated', format('public.%I', target_table_name), 'TRUNCATE')
      or has_table_privilege('authenticated', format('public.%I', target_table_name), 'REFERENCES')
      or has_table_privilege('authenticated', format('public.%I', target_table_name), 'TRIGGER') then
      raise exception 'Milestone 2B-4 verification failed: authenticated has non-CRUD privileges on public.%',
        target_table_name;
    end if;

    if not (
      has_table_privilege('service_role', format('public.%I', target_table_name), 'SELECT')
      and has_table_privilege('service_role', format('public.%I', target_table_name), 'INSERT')
      and has_table_privilege('service_role', format('public.%I', target_table_name), 'UPDATE')
      and has_table_privilege('service_role', format('public.%I', target_table_name), 'DELETE')
      and has_table_privilege('service_role', format('public.%I', target_table_name), 'TRUNCATE')
      and has_table_privilege('service_role', format('public.%I', target_table_name), 'REFERENCES')
      and has_table_privilege('service_role', format('public.%I', target_table_name), 'TRIGGER')
    ) then
      raise exception 'Milestone 2B-4 verification failed: service_role privileges missing on public.%',
        target_table_name;
    end if;
  end loop;

  if (
    select count(*)
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'daily_plans'
  ) <> 6 then
    raise exception 'Milestone 2B-4 verification failed: daily_plans columns differ';
  end if;

  if (
    select count(*)
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'planned_actions'
  ) <> 11 then
    raise exception 'Milestone 2B-4 verification failed: planned_actions columns differ';
  end if;

  if exists (
    select 1
    from (
      values
        ('daily_plans', 'id', 'uuid', 'NO', true),
        ('daily_plans', 'user_id', 'uuid', 'NO', false),
        ('daily_plans', 'plan_date', 'date', 'NO', false),
        ('daily_plans', 'summary', 'text', 'YES', false),
        ('daily_plans', 'created_at', 'timestamp with time zone', 'NO', true),
        ('daily_plans', 'updated_at', 'timestamp with time zone', 'NO', true),
        ('planned_actions', 'id', 'uuid', 'NO', true),
        ('planned_actions', 'user_id', 'uuid', 'NO', false),
        ('planned_actions', 'daily_plan_id', 'uuid', 'NO', false),
        ('planned_actions', 'task_id', 'uuid', 'YES', false),
        ('planned_actions', 'title', 'text', 'NO', false),
        ('planned_actions', 'start_at', 'timestamp with time zone', 'NO', false),
        ('planned_actions', 'end_at', 'timestamp with time zone', 'NO', false),
        ('planned_actions', 'reason', 'text', 'YES', false),
        ('planned_actions', 'status', 'text', 'NO', true),
        ('planned_actions', 'created_at', 'timestamp with time zone', 'NO', true),
        ('planned_actions', 'updated_at', 'timestamp with time zone', 'NO', true)
    ) as expected(table_name, column_name, data_type, is_nullable, has_default)
    where not exists (
      select 1
      from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = expected.table_name
        and actual.column_name = expected.column_name
        and actual.data_type = expected.data_type
        and actual.is_nullable = expected.is_nullable
        and (actual.column_default is not null) = expected.has_default
    )
  ) then
    raise exception 'Milestone 2B-4 verification failed: column type, nullability, or default differs';
  end if;

  if (
    select column_info.column_default
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'planned_actions'
      and column_info.column_name = 'status'
  ) <> '''scheduled''::text' then
    raise exception 'Milestone 2B-4 verification failed: planned_actions status default differs';
  end if;

  if (
    select count(*)
    from pg_constraint as constraint_info
    where (constraint_info.conname, constraint_info.conrelid, constraint_info.contype) in (
      ('tasks_id_user_id_key', 'public.tasks'::regclass, 'u'),
      ('daily_plans_pkey', 'public.daily_plans'::regclass, 'p'),
      ('daily_plans_id_user_id_key', 'public.daily_plans'::regclass, 'u'),
      ('daily_plans_user_id_plan_date_key', 'public.daily_plans'::regclass, 'u'),
      ('planned_actions_pkey', 'public.planned_actions'::regclass, 'p')
    )
      and constraint_info.convalidated
  ) <> 5 then
    raise exception 'Milestone 2B-4 verification failed: primary or unique constraints differ';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_info
    where constraint_info.conname = 'daily_plans_user_id_fkey'
      and constraint_info.conrelid = 'public.daily_plans'::regclass
      and pg_get_constraintdef(constraint_info.oid) =
        'FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE'
  ) then
    raise exception 'Milestone 2B-4 verification failed: daily_plans owner FK differs';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_info
    where constraint_info.conname = 'planned_actions_user_id_fkey'
      and constraint_info.conrelid = 'public.planned_actions'::regclass
      and pg_get_constraintdef(constraint_info.oid) =
        'FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE'
  ) then
    raise exception 'Milestone 2B-4 verification failed: planned_actions owner FK differs';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_info
    where constraint_info.conname = 'planned_actions_daily_plan_owner_fkey'
      and constraint_info.conrelid = 'public.planned_actions'::regclass
      and pg_get_constraintdef(constraint_info.oid) =
        'FOREIGN KEY (daily_plan_id, user_id) REFERENCES daily_plans(id, user_id) ON DELETE CASCADE'
  ) then
    raise exception 'Milestone 2B-4 verification failed: planned_actions daily plan owner FK differs';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_info
    where constraint_info.conname = 'planned_actions_task_owner_fkey'
      and constraint_info.conrelid = 'public.planned_actions'::regclass
      and pg_get_constraintdef(constraint_info.oid) =
        'FOREIGN KEY (task_id, user_id) REFERENCES tasks(id, user_id) ON DELETE SET NULL (task_id)'
  ) then
    raise exception 'Milestone 2B-4 verification failed: planned_actions task owner FK differs';
  end if;

  if (
    select count(*)
    from pg_constraint as constraint_info
    where (constraint_info.conname, constraint_info.conrelid) in (
      ('planned_actions_title_not_blank', 'public.planned_actions'::regclass),
      ('planned_actions_time_range_valid', 'public.planned_actions'::regclass),
      ('planned_actions_status_valid', 'public.planned_actions'::regclass)
    )
      and constraint_info.contype = 'c'
      and constraint_info.convalidated
  ) <> 3 then
    raise exception 'Milestone 2B-4 verification failed: planned_actions CHECK constraints differ';
  end if;

  if (
    select count(*)
    from pg_trigger as trigger_info
    where not trigger_info.tgisinternal
      and trigger_info.tgenabled <> 'D'
      and (trigger_info.tgname, trigger_info.tgrelid, trigger_info.tgfoid) in (
        (
          'daily_plans_set_updated_at',
          'public.daily_plans'::regclass,
          'public.set_updated_at()'::regprocedure
        ),
        (
          'planned_actions_set_updated_at',
          'public.planned_actions'::regclass,
          'public.set_updated_at()'::regprocedure
        )
      )
  ) <> 2 then
    raise exception 'Milestone 2B-4 verification failed: updated_at triggers differ';
  end if;

  foreach target_index_name in array array[
    'planned_actions_user_id_start_at_idx',
    'planned_actions_daily_plan_id_idx',
    'planned_actions_task_id_idx'
  ]
  loop
    if to_regclass('public.' || target_index_name) is null then
      raise exception 'Milestone 2B-4 verification failed: index % is missing', target_index_name;
    end if;
  end loop;
end;
$catalog$;

insert into auth.users (id, email)
values
  ('41000000-0000-4000-8000-000000000001', 'm2b4-owner@example.invalid'),
  ('41000000-0000-4000-8000-000000000002', 'm2b4-other@example.invalid');

insert into public.tasks (
  id,
  user_id,
  title,
  estimated_minutes,
  priority,
  status
)
values
  (
    '42000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    'Owner task',
    30,
    'high',
    'scheduled'
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000002',
    'Other task',
    20,
    'medium',
    'scheduled'
  );

insert into public.daily_plans (id, user_id, plan_date, summary)
values (
  '43000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000002',
  '2040-01-01',
  'Other plan'
);

insert into public.planned_actions (
  id,
  user_id,
  daily_plan_id,
  task_id,
  title,
  start_at,
  end_at,
  reason
)
values (
  '44000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000002',
  '43000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000002',
  'Other action',
  '2040-01-01T09:00:00Z',
  '2040-01-01T09:30:00Z',
  'Other reason'
);

set local role anon;

do $anon_denied$
begin
  begin
    perform count(*) from public.daily_plans;
    raise exception 'Milestone 2B-4 verification failed: anon selected daily_plans';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.daily_plans (user_id, plan_date)
    values ('41000000-0000-4000-8000-000000000001', '2040-01-01');
    raise exception 'Milestone 2B-4 verification failed: anon inserted daily_plans';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.daily_plans set summary = 'anon';
    raise exception 'Milestone 2B-4 verification failed: anon updated daily_plans';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.daily_plans;
    raise exception 'Milestone 2B-4 verification failed: anon deleted daily_plans';
  exception when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.planned_actions;
    raise exception 'Milestone 2B-4 verification failed: anon selected planned_actions';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.planned_actions (
      user_id,
      daily_plan_id,
      title,
      start_at,
      end_at
    )
    values (
      '41000000-0000-4000-8000-000000000002',
      '43000000-0000-4000-8000-000000000002',
      'Anon action',
      '2040-01-01T10:00:00Z',
      '2040-01-01T10:30:00Z'
    );
    raise exception 'Milestone 2B-4 verification failed: anon inserted planned_actions';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.planned_actions set title = 'anon';
    raise exception 'Milestone 2B-4 verification failed: anon updated planned_actions';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.planned_actions;
    raise exception 'Milestone 2B-4 verification failed: anon deleted planned_actions';
  exception when insufficient_privilege then null;
  end;
end;
$anon_denied$;

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

insert into public.daily_plans (id, user_id, plan_date, summary)
values (
  '43000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  '2040-01-01',
  'Owner plan'
);

insert into public.planned_actions (
  id,
  user_id,
  daily_plan_id,
  task_id,
  title,
  start_at,
  end_at,
  reason
)
values
  (
    '44000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000001',
    '42000000-0000-4000-8000-000000000001',
    'Title retained after task deletion',
    '2040-01-01T09:00:00Z',
    '2040-01-01T09:30:00Z',
    'Owner reason'
  ),
  (
    '44000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000001',
    '43000000-0000-4000-8000-000000000001',
    null,
    'Owner action without task',
    '2040-01-01T10:00:00Z',
    '2040-01-01T10:20:00Z',
    null
  );

do $owner_crud_and_boundaries$
declare
  affected integer;
begin
  if (select count(*) from public.daily_plans) <> 1 then
    raise exception 'Milestone 2B-4 verification failed: owner daily_plans SELECT scope differs';
  end if;

  if (select count(*) from public.planned_actions) <> 2 then
    raise exception 'Milestone 2B-4 verification failed: owner planned_actions SELECT scope differs';
  end if;

  if not exists (
    select 1
    from public.planned_actions
    where id = '44000000-0000-4000-8000-000000000001'
      and status = 'scheduled'
      and created_at is not null
      and updated_at is not null
  ) then
    raise exception 'Milestone 2B-4 verification failed: planned action defaults differ';
  end if;

  update public.daily_plans
  set summary = 'Owner plan updated', updated_at = '2000-01-01T00:00:00Z'
  where id = '43000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (
    select 1
    from public.daily_plans
    where id = '43000000-0000-4000-8000-000000000001'
      and summary = 'Owner plan updated'
      and updated_at > '2020-01-01T00:00:00Z'
  ) then
    raise exception 'Milestone 2B-4 verification failed: daily plan UPDATE or trigger differs';
  end if;

  update public.planned_actions
  set status = 'completed', updated_at = '2000-01-01T00:00:00Z'
  where id = '44000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (
    select 1
    from public.planned_actions
    where id = '44000000-0000-4000-8000-000000000001'
      and status = 'completed'
      and updated_at > '2020-01-01T00:00:00Z'
  ) then
    raise exception 'Milestone 2B-4 verification failed: planned action UPDATE or trigger differs';
  end if;

  update public.planned_actions
  set status = 'skipped'
  where id = '44000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (
    select 1
    from public.planned_actions
    where id = '44000000-0000-4000-8000-000000000003'
      and status = 'skipped'
  ) then
    raise exception 'Milestone 2B-4 verification failed: skipped action status was not accepted';
  end if;

  begin
    update public.planned_actions
    set
      user_id = '41000000-0000-4000-8000-000000000002',
      daily_plan_id = '43000000-0000-4000-8000-000000000002',
      task_id = '42000000-0000-4000-8000-000000000002'
    where id = '44000000-0000-4000-8000-000000000001';
    raise exception 'Milestone 2B-4 verification failed: owner transferred planned action ownership';
  exception when insufficient_privilege then null;
  end;

  update public.daily_plans
  set summary = 'Stolen'
  where id = '43000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2B-4 verification failed: owner updated another daily plan';
  end if;

  delete from public.daily_plans
  where id = '43000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2B-4 verification failed: owner deleted another daily plan';
  end if;

  update public.planned_actions
  set title = 'Stolen'
  where id = '44000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2B-4 verification failed: owner updated another planned action';
  end if;

  delete from public.planned_actions
  where id = '44000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2B-4 verification failed: owner deleted another planned action';
  end if;

  begin
    insert into public.daily_plans (user_id, plan_date)
    values ('41000000-0000-4000-8000-000000000002', '2040-01-02');
    raise exception 'Milestone 2B-4 verification failed: owner inserted another user daily plan';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.planned_actions (
      user_id,
      daily_plan_id,
      task_id,
      title,
      start_at,
      end_at
    )
    values (
      '41000000-0000-4000-8000-000000000002',
      '43000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000002',
      'Other user action through owner session',
      '2040-01-01T11:00:00Z',
      '2040-01-01T11:30:00Z'
    );
    raise exception 'Milestone 2B-4 verification failed: owner inserted another user planned action';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.daily_plans (user_id, plan_date)
    values ('41000000-0000-4000-8000-000000000001', '2040-01-01');
    raise exception 'Milestone 2B-4 verification failed: duplicate local plan date accepted';
  exception when unique_violation then null;
  end;

  begin
    insert into public.planned_actions (
      user_id,
      daily_plan_id,
      title,
      start_at,
      end_at
    )
    values (
      '41000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000002',
      'Cross-owner daily plan',
      '2040-01-01T11:00:00Z',
      '2040-01-01T11:30:00Z'
    );
    raise exception 'Milestone 2B-4 verification failed: daily plan owner composite FK allowed mismatch';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.planned_actions (
      user_id,
      daily_plan_id,
      task_id,
      title,
      start_at,
      end_at
    )
    values (
      '41000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000002',
      'Cross-owner task',
      '2040-01-01T11:00:00Z',
      '2040-01-01T11:30:00Z'
    );
    raise exception 'Milestone 2B-4 verification failed: task owner composite FK allowed mismatch';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.planned_actions (
      user_id,
      daily_plan_id,
      title,
      start_at,
      end_at
    )
    values (
      '41000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000001',
      '   ',
      '2040-01-01T11:00:00Z',
      '2040-01-01T11:30:00Z'
    );
    raise exception 'Milestone 2B-4 verification failed: blank action title accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.planned_actions (
      user_id,
      daily_plan_id,
      title,
      start_at,
      end_at,
      status
    )
    values (
      '41000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000001',
      'Invalid status',
      '2040-01-01T11:00:00Z',
      '2040-01-01T11:30:00Z',
      'pending'
    );
    raise exception 'Milestone 2B-4 verification failed: invalid action status accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.planned_actions (
      user_id,
      daily_plan_id,
      title,
      start_at,
      end_at
    )
    values (
      '41000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000001',
      'Invalid time range',
      '2040-01-01T12:00:00Z',
      '2040-01-01T12:00:00Z'
    );
    raise exception 'Milestone 2B-4 verification failed: invalid action time range accepted';
  exception when check_violation then null;
  end;

  delete from public.planned_actions
  where id = '44000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Milestone 2B-4 verification failed: owner planned action DELETE denied';
  end if;
end;
$owner_crud_and_boundaries$;

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $other_intact$
begin
  if (select count(*) from public.daily_plans) <> 1 or not exists (
    select 1
    from public.daily_plans
    where id = '43000000-0000-4000-8000-000000000002'
      and summary = 'Other plan'
  ) then
    raise exception 'Milestone 2B-4 verification failed: other daily plan scope or data differs';
  end if;

  if (select count(*) from public.planned_actions) <> 1 or not exists (
    select 1
    from public.planned_actions
    where id = '44000000-0000-4000-8000-000000000002'
      and title = 'Other action'
  ) then
    raise exception 'Milestone 2B-4 verification failed: other planned action scope or data differs';
  end if;
end;
$other_intact$;

reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;

delete from public.tasks
where id = '42000000-0000-4000-8000-000000000001';

do $task_set_null$
begin
  if not exists (
    select 1
    from public.planned_actions
    where id = '44000000-0000-4000-8000-000000000001'
      and user_id = '41000000-0000-4000-8000-000000000001'
      and task_id is null
      and title = 'Title retained after task deletion'
  ) then
    raise exception 'Milestone 2B-4 verification failed: task delete did not retain action title and null task_id';
  end if;
end;
$task_set_null$;

delete from public.daily_plans
where id = '43000000-0000-4000-8000-000000000001';

do $daily_plan_cascade$
begin
  if exists (
    select 1
    from public.planned_actions
    where daily_plan_id = '43000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Milestone 2B-4 verification failed: daily plan delete did not cascade actions';
  end if;
end;
$daily_plan_cascade$;

reset role;
rollback;

select 'milestone_2b4_remote_verification_passed' as result;
