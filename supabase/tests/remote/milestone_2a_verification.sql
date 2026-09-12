-- Remote-only Milestone 2A verification.
-- All fixture writes occur inside this transaction and are rolled back.

begin;

set local statement_timeout = '30s';

do $catalog$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'goals', 'tasks']
  loop
    if not exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = table_name
        and relation.relkind = 'r'
        and relation.relrowsecurity
    ) then
      raise exception 'Milestone 2A verification failed: %.% is missing or RLS is disabled',
        'public', table_name;
    end if;

    if (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and roles = array['authenticated']::name[]
        and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        and policyname in (
          table_name || '_select_own',
          table_name || '_insert_own',
          table_name || '_update_own',
          table_name || '_delete_own'
        )
    ) <> 4 then
      raise exception 'Milestone 2A verification failed: %.% policies differ',
        'public', table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      or has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      or has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
      or has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
      or has_table_privilege('anon', format('public.%I', table_name), 'TRUNCATE')
      or has_table_privilege('anon', format('public.%I', table_name), 'REFERENCES')
      or has_table_privilege('anon', format('public.%I', table_name), 'TRIGGER') then
      raise exception 'Milestone 2A verification failed: anon has privileges on public.%',
        table_name;
    end if;

    if not (
      has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
      and has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
      and has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
      and has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
    ) then
      raise exception 'Milestone 2A verification failed: authenticated CRUD grants missing on public.%',
        table_name;
    end if;

    if has_table_privilege('authenticated', format('public.%I', table_name), 'TRUNCATE')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'REFERENCES')
      or has_table_privilege('authenticated', format('public.%I', table_name), 'TRIGGER') then
      raise exception 'Milestone 2A verification failed: authenticated has non-CRUD privileges on public.%',
        table_name;
    end if;

    if not (
      has_table_privilege('service_role', format('public.%I', table_name), 'SELECT')
      and has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
      and has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
      and has_table_privilege('service_role', format('public.%I', table_name), 'DELETE')
      and has_table_privilege('service_role', format('public.%I', table_name), 'TRUNCATE')
      and has_table_privilege('service_role', format('public.%I', table_name), 'REFERENCES')
      and has_table_privilege('service_role', format('public.%I', table_name), 'TRIGGER')
    ) then
      raise exception 'Milestone 2A verification failed: service_role table privileges missing on public.%',
        table_name;
    end if;
  end loop;

  if (
    select count(*)
    from information_schema.columns as info_column
    where info_column.table_schema = 'public'
      and info_column.table_name = 'profiles'
  ) <> 8 then
    raise exception 'Milestone 2A verification failed: profiles columns differ';
  end if;

  if (
    select count(*)
    from information_schema.columns as info_column
    where info_column.table_schema = 'public'
      and info_column.table_name = 'goals'
  ) <> 12 then
    raise exception 'Milestone 2A verification failed: goals columns differ';
  end if;

  if (
    select count(*)
    from information_schema.columns as info_column
    where info_column.table_schema = 'public'
      and info_column.table_name = 'tasks'
  ) <> 10 then
    raise exception 'Milestone 2A verification failed: tasks columns differ';
  end if;

  if exists (
    select 1
    from (
      values
        ('profiles', 'id', 'uuid', 'NO', false),
        ('profiles', 'display_name', 'text', 'YES', false),
        ('profiles', 'timezone', 'text', 'NO', true),
        ('profiles', 'planning_start', 'time without time zone', 'NO', true),
        ('profiles', 'planning_end', 'time without time zone', 'NO', true),
        ('profiles', 'minimum_free_minutes', 'integer', 'NO', true),
        ('profiles', 'created_at', 'timestamp with time zone', 'NO', true),
        ('profiles', 'updated_at', 'timestamp with time zone', 'NO', true),
        ('goals', 'id', 'uuid', 'NO', true),
        ('goals', 'user_id', 'uuid', 'NO', false),
        ('goals', 'title', 'text', 'NO', false),
        ('goals', 'description', 'text', 'YES', false),
        ('goals', 'current_value', 'numeric', 'YES', false),
        ('goals', 'target_value', 'numeric', 'YES', false),
        ('goals', 'unit', 'text', 'YES', false),
        ('goals', 'deadline', 'date', 'YES', false),
        ('goals', 'priority', 'text', 'NO', false),
        ('goals', 'status', 'text', 'NO', false),
        ('goals', 'created_at', 'timestamp with time zone', 'NO', true),
        ('goals', 'updated_at', 'timestamp with time zone', 'NO', true),
        ('tasks', 'id', 'uuid', 'NO', true),
        ('tasks', 'user_id', 'uuid', 'NO', false),
        ('tasks', 'goal_id', 'uuid', 'YES', false),
        ('tasks', 'title', 'text', 'NO', false),
        ('tasks', 'estimated_minutes', 'integer', 'NO', false),
        ('tasks', 'deadline', 'timestamp with time zone', 'YES', false),
        ('tasks', 'priority', 'text', 'NO', false),
        ('tasks', 'status', 'text', 'NO', false),
        ('tasks', 'created_at', 'timestamp with time zone', 'NO', true),
        ('tasks', 'updated_at', 'timestamp with time zone', 'NO', true)
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
    raise exception 'Milestone 2A verification failed: column type, nullability, or default differs';
  end if;

  if (
    select count(*)
    from pg_constraint
    where (conname, conrelid, contype) in (
      ('profiles_pkey', 'public.profiles'::regclass, 'p'),
      ('goals_pkey', 'public.goals'::regclass, 'p'),
      ('tasks_pkey', 'public.tasks'::regclass, 'p'),
      ('goals_id_user_id_key', 'public.goals'::regclass, 'u')
    )
      and convalidated
  ) <> 4 then
    raise exception 'Milestone 2A verification failed: primary or composite unique constraint differs';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_id_fkey'
      and conrelid = 'public.profiles'::regclass
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'
  ) then
    raise exception 'Milestone 2A verification failed: profiles auth FK differs';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'goals_user_id_fkey'
      and conrelid = 'public.goals'::regclass
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE'
  ) then
    raise exception 'Milestone 2A verification failed: goals owner FK differs';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_user_id_fkey'
      and conrelid = 'public.tasks'::regclass
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE'
  ) then
    raise exception 'Milestone 2A verification failed: tasks owner FK differs';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_goal_owner_fkey'
      and conrelid = 'public.tasks'::regclass
      and pg_get_constraintdef(oid) =
        'FOREIGN KEY (goal_id, user_id) REFERENCES goals(id, user_id) ON DELETE SET NULL (goal_id)'
  ) then
    raise exception 'Milestone 2A verification failed: tasks composite goal FK differs';
  end if;

  if (
    select count(*)
    from pg_constraint
    where (conname, conrelid) in (
      ('profiles_minimum_free_minutes_positive', 'public.profiles'::regclass),
      ('goals_title_not_blank', 'public.goals'::regclass),
      ('goals_priority_valid', 'public.goals'::regclass),
      ('goals_status_valid', 'public.goals'::regclass),
      ('tasks_title_not_blank', 'public.tasks'::regclass),
      ('tasks_estimated_minutes_positive', 'public.tasks'::regclass),
      ('tasks_priority_valid', 'public.tasks'::regclass),
      ('tasks_status_valid', 'public.tasks'::regclass)
    )
      and contype = 'c'
      and convalidated
  ) <> 8 then
    raise exception 'Milestone 2A verification failed: CHECK constraints differ';
  end if;

  if (
    select count(*)
    from pg_trigger as trigger
    where not trigger.tgisinternal
      and trigger.tgenabled <> 'D'
      and (trigger.tgname, trigger.tgrelid, trigger.tgfoid) in (
        (
          'profiles_set_updated_at',
          'public.profiles'::regclass,
          'public.set_updated_at()'::regprocedure
        ),
        (
          'goals_set_updated_at',
          'public.goals'::regclass,
          'public.set_updated_at()'::regprocedure
        ),
        (
          'tasks_set_updated_at',
          'public.tasks'::regclass,
          'public.set_updated_at()'::regprocedure
        ),
        (
          'ai_life_planner_auth_user_created',
          'auth.users'::regclass,
          'public.handle_new_auth_user()'::regprocedure
        )
      )
  ) <> 4 then
    raise exception 'Milestone 2A verification failed: triggers differ';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    where procedure.oid = 'public.set_updated_at()'::regprocedure
      and not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
  ) or not exists (
    select 1
    from pg_proc as procedure
    where procedure.oid = 'public.handle_new_auth_user()'::regprocedure
      and procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'Milestone 2A verification failed: trigger function security settings differ';
  end if;

  if has_function_privilege('anon', 'public.set_updated_at()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.set_updated_at()', 'EXECUTE')
    or has_function_privilege('anon', 'public.handle_new_auth_user()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.handle_new_auth_user()', 'EXECUTE') then
    raise exception 'Milestone 2A verification failed: trigger function EXECUTE grant differs';
  end if;
end;
$catalog$;

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'm2a-owner@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'm2a-other@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'm2a-fresh@example.invalid');

delete from public.profiles
where id = '10000000-0000-4000-8000-000000000003';

insert into public.goals (id, user_id, title, priority, status)
values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'Other goal',
  'medium',
  'active'
);

insert into public.tasks (
  id,
  user_id,
  goal_id,
  title,
  estimated_minutes,
  priority,
  status
)
values (
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'Other task',
  20,
  'medium',
  'pending'
);

set local role anon;

do $anon_denied$
begin
  begin
    perform count(*) from public.profiles;
    raise exception 'Milestone 2A verification failed: anon selected profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id) values ('10000000-0000-4000-8000-000000000001');
    raise exception 'Milestone 2A verification failed: anon inserted profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles
    set display_name = 'anon'
    where id = '10000000-0000-4000-8000-000000000002';
    raise exception 'Milestone 2A verification failed: anon updated profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profiles
    where id = '10000000-0000-4000-8000-000000000002';
    raise exception 'Milestone 2A verification failed: anon deleted profiles';
  exception when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.goals;
    raise exception 'Milestone 2A verification failed: anon selected goals';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.goals (user_id, title, priority, status)
    values ('10000000-0000-4000-8000-000000000001', 'Anon goal', 'low', 'active');
    raise exception 'Milestone 2A verification failed: anon inserted goals';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.goals
    set title = 'Anon goal'
    where id = '20000000-0000-4000-8000-000000000002';
    raise exception 'Milestone 2A verification failed: anon updated goals';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.goals
    where id = '20000000-0000-4000-8000-000000000002';
    raise exception 'Milestone 2A verification failed: anon deleted goals';
  exception when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.tasks;
    raise exception 'Milestone 2A verification failed: anon selected tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tasks (user_id, title, estimated_minutes, priority, status)
    values ('10000000-0000-4000-8000-000000000001', 'Anon task', 10, 'low', 'pending');
    raise exception 'Milestone 2A verification failed: anon inserted tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.tasks
    set title = 'Anon task'
    where id = '30000000-0000-4000-8000-000000000002';
    raise exception 'Milestone 2A verification failed: anon updated tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.tasks
    where id = '30000000-0000-4000-8000-000000000002';
    raise exception 'Milestone 2A verification failed: anon deleted tasks';
  exception when insufficient_privilege then null;
  end;
end;
$anon_denied$;

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $owner_profile$
declare
  affected integer;
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Milestone 2A verification failed: owner profile SELECT scope differs';
  end if;

  update public.profiles
  set display_name = 'Owner updated', updated_at = '2000-01-01T00:00:00Z'
  where id = '10000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Milestone 2A verification failed: owner profile UPDATE denied';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000001'
      and display_name = 'Owner updated'
      and updated_at > '2020-01-01T00:00:00Z'
  ) then
    raise exception 'Milestone 2A verification failed: profiles updated_at trigger differs';
  end if;

  update public.profiles
  set display_name = 'Stolen'
  where id = '10000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2A verification failed: owner updated another profile';
  end if;

  delete from public.profiles
  where id = '10000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2A verification failed: owner deleted another profile';
  end if;

  begin
    insert into public.profiles (id)
    values ('10000000-0000-4000-8000-000000000003');
    raise exception 'Milestone 2A verification failed: owner inserted another profile';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set id = '10000000-0000-4000-8000-000000000003'
    where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Milestone 2A verification failed: owner changed profile ownership';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set minimum_free_minutes = 0
    where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Milestone 2A verification failed: invalid minimum free minutes accepted';
  exception when check_violation then null;
  end;
end;
$owner_profile$;

insert into public.goals (id, user_id, title, priority, status)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Owner goal',
  'high',
  'active'
);

insert into public.goals (id, user_id, title, priority, status)
values (
  '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  'Owner transfer boundary goal',
  'low',
  'active'
);

insert into public.tasks (
  id,
  user_id,
  goal_id,
  title,
  estimated_minutes,
  priority,
  status
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Owner task to delete',
    20,
    'high',
    'pending'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Owner task to preserve',
    30,
    'high',
    'scheduled'
  );

do $owner_data$
declare
  affected integer;
begin
  if (select count(*) from public.goals) <> 2 then
    raise exception 'Milestone 2A verification failed: owner goals SELECT scope differs';
  end if;
  if (select count(*) from public.tasks) <> 2 then
    raise exception 'Milestone 2A verification failed: owner tasks SELECT scope differs';
  end if;

  update public.goals
  set title = 'Owner goal updated', updated_at = '2000-01-01T00:00:00Z'
  where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (
    select 1 from public.goals
    where id = '20000000-0000-4000-8000-000000000001'
      and title = 'Owner goal updated'
      and updated_at > '2020-01-01T00:00:00Z'
  ) then
    raise exception 'Milestone 2A verification failed: owner goal UPDATE or trigger differs';
  end if;

  update public.tasks
  set title = 'Owner task updated', updated_at = '2000-01-01T00:00:00Z'
  where id = '30000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (
    select 1 from public.tasks
    where id = '30000000-0000-4000-8000-000000000001'
      and title = 'Owner task updated'
      and updated_at > '2020-01-01T00:00:00Z'
  ) then
    raise exception 'Milestone 2A verification failed: owner task UPDATE or trigger differs';
  end if;

  begin
    update public.goals
    set user_id = '10000000-0000-4000-8000-000000000002'
    where id = '20000000-0000-4000-8000-000000000003';
    raise exception 'Milestone 2A verification failed: owner changed goal ownership';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.tasks
    set
      user_id = '10000000-0000-4000-8000-000000000002',
      goal_id = '20000000-0000-4000-8000-000000000002'
    where id = '30000000-0000-4000-8000-000000000001';
    raise exception 'Milestone 2A verification failed: owner changed task ownership';
  exception when insufficient_privilege then null;
  end;

  update public.goals
  set title = 'Stolen goal'
  where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2A verification failed: owner updated another goal';
  end if;

  delete from public.goals
  where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2A verification failed: owner deleted another goal';
  end if;

  update public.tasks
  set title = 'Stolen task'
  where id = '30000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2A verification failed: owner updated another task';
  end if;

  delete from public.tasks
  where id = '30000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Milestone 2A verification failed: owner deleted another task';
  end if;

  begin
    insert into public.goals (user_id, title, priority, status)
    values (
      '10000000-0000-4000-8000-000000000002',
      'Cross-owner goal',
      'low',
      'active'
    );
    raise exception 'Milestone 2A verification failed: owner inserted another user goal';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.tasks (user_id, title, estimated_minutes, priority, status)
    values (
      '10000000-0000-4000-8000-000000000002',
      'Cross-owner task',
      10,
      'low',
      'pending'
    );
    raise exception 'Milestone 2A verification failed: owner inserted another user task';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.tasks (user_id, goal_id, title, estimated_minutes, priority, status)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'Cross-owner goal reference',
      10,
      'low',
      'pending'
    );
    raise exception 'Milestone 2A verification failed: composite FK allowed another user goal';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.goals (user_id, title, priority, status)
    values ('10000000-0000-4000-8000-000000000001', '   ', 'low', 'active');
    raise exception 'Milestone 2A verification failed: blank goal title accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.goals (user_id, title, priority, status)
    values ('10000000-0000-4000-8000-000000000001', 'Invalid priority', 'urgent', 'active');
    raise exception 'Milestone 2A verification failed: invalid goal priority accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.goals (user_id, title, priority, status)
    values ('10000000-0000-4000-8000-000000000001', 'Invalid status', 'low', 'paused');
    raise exception 'Milestone 2A verification failed: invalid goal status accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.tasks (user_id, title, estimated_minutes, priority, status)
    values ('10000000-0000-4000-8000-000000000001', '   ', 10, 'low', 'pending');
    raise exception 'Milestone 2A verification failed: blank task title accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.tasks (user_id, title, estimated_minutes, priority, status)
    values ('10000000-0000-4000-8000-000000000001', 'Invalid estimate', 0, 'low', 'pending');
    raise exception 'Milestone 2A verification failed: invalid task estimate accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.tasks (user_id, title, estimated_minutes, priority, status)
    values ('10000000-0000-4000-8000-000000000001', 'Invalid priority', 10, 'urgent', 'pending');
    raise exception 'Milestone 2A verification failed: invalid task priority accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.tasks (user_id, title, estimated_minutes, priority, status)
    values ('10000000-0000-4000-8000-000000000001', 'Invalid status', 10, 'low', 'blocked');
    raise exception 'Milestone 2A verification failed: invalid task status accepted';
  exception when check_violation then null;
  end;
end;
$owner_data$;

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $other_intact$
begin
  if not exists (
    select 1 from public.profiles
    where id = '10000000-0000-4000-8000-000000000002'
      and display_name is null
  ) then
    raise exception 'Milestone 2A verification failed: other profile changed or disappeared';
  end if;
  if not exists (
    select 1 from public.goals
    where id = '20000000-0000-4000-8000-000000000002'
      and title = 'Other goal'
  ) then
    raise exception 'Milestone 2A verification failed: other goal changed or disappeared';
  end if;
  if not exists (
    select 1 from public.tasks
    where id = '30000000-0000-4000-8000-000000000002'
      and title = 'Other task'
  ) then
    raise exception 'Milestone 2A verification failed: other task changed or disappeared';
  end if;
end;
$other_intact$;

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
set local role authenticated;

insert into public.profiles (id, display_name)
values ('10000000-0000-4000-8000-000000000003', 'Fresh profile');

do $fresh_profile$
declare
  affected integer;
begin
  update public.profiles
  set display_name = 'Fresh profile updated'
  where id = '10000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Milestone 2A verification failed: own profile INSERT/UPDATE differs';
  end if;

  delete from public.profiles
  where id = '10000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Milestone 2A verification failed: own profile DELETE differs';
  end if;
end;
$fresh_profile$;

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $owner_delete_and_fk_action$
declare
  affected integer;
begin
  delete from public.tasks
  where id = '30000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Milestone 2A verification failed: owner task DELETE denied';
  end if;

  delete from public.goals
  where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Milestone 2A verification failed: owner goal DELETE denied';
  end if;

  if not exists (
    select 1 from public.tasks
    where id = '30000000-0000-4000-8000-000000000003'
      and user_id = '10000000-0000-4000-8000-000000000001'
      and goal_id is null
  ) then
    raise exception 'Milestone 2A verification failed: goal delete did not preserve task and null goal_id';
  end if;
end;
$owner_delete_and_fk_action$;

reset role;
rollback;

select 'milestone_2a_remote_verification_passed' as result;
