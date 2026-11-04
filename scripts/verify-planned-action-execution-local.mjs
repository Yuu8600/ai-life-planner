import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Optional test tools live OUTSIDE the app dependency tree. No network or remote DB access.
const toolsDirectory = process.argv[2];
const options = new Set(process.argv.slice(3));
const generateTypes = options.has('--generate-types');
const verifyActivity = options.has('--milestone=5b');
const verifyPermissionFix = options.has('--permission-fix');
const checkTypes = options.has('--check-types');
if (
  !toolsDirectory ||
  [...options].some(
    (option) =>
      !['--generate-types', '--milestone=5b', '--permission-fix', '--check-types'].includes(option),
  )
) {
  console.error(
    'Usage: node scripts/verify-planned-action-execution-local.mjs <tools-directory> [--generate-types|--check-types] [--milestone=5b] [--permission-fix]',
  );
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolRequire = createRequire(pathToFileURL(resolve(toolsDirectory, 'package.json')));
const { PGlite } = await import(pathToFileURL(toolRequire.resolve('@electric-sql/pglite')));
const db = await PGlite.create();
try {
  // Minimal Supabase auth/catalog bootstrap for an isolated, in-memory Postgres database.
  // The public schema is never simulated: all versioned migrations run unchanged.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  if (verifyPermissionFix) {
    await db.exec(`create role local_managed_auth_owner nologin;
      alter schema auth owner to local_managed_auth_owner;`);
  }
  const migrationsDirectory = resolve(root, 'supabase/migrations');
  for (const filename of (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    if (
      verifyPermissionFix &&
      filename === '20261104090000_fix_activity_log_trigger_permissions.sql'
    ) {
      await db.exec(
        await readFile(
          resolve(root, 'supabase/tests/local/activity_log_auth_namespace_regression.sql'),
          'utf8',
        ),
      );
      console.log('Before-fix auth namespace failure reproduced; partial state rolled back.');
    }
    await db.exec(await readFile(resolve(migrationsDirectory, filename), 'utf8'));
    if (verifyPermissionFix && filename === '20261009090000_add_activity_logs.sql') {
      // Reproduce the observed remote state even though this in-memory bootstrap
      // admin is a superuser and could grant privileges unlike managed postgres.
      await db.exec('revoke usage on schema auth from ai_life_planner_activity_writer;');
    }
    console.log('Applied local migration: ' + filename);
  }
  if (verifyPermissionFix) {
    await db.exec(
      await readFile(
        resolve(root, 'supabase/tests/local/activity_log_reason_write_surface.sql'),
        'utf8',
      ),
    );
    console.log('Superseded reason-write surface reproduced; grant and fixtures rolled back.');
    await db.exec(
      await readFile(resolve(root, 'supabase/tests/remote/milestone_4d_verification.sql'), 'utf8'),
    );
    console.log('4D atomic Planner persistence SQL regression passed; fixtures rolled back.');
  }
  await db.exec(
    await readFile(resolve(root, 'supabase/tests/remote/milestone_5a_verification.sql'), 'utf8'),
  );
  const counts = await db.query(
    'select (select count(*) from auth.users)::int as users, (select count(*) from public.tasks)::int as tasks, (select count(*) from public.planned_actions)::int as actions',
  );
  if (Object.values(counts.rows[0]).some((count) => count !== 0))
    throw new Error('Fixture rollback failed');
  console.log('5A SQL verification passed; fixtures rolled back.');
  if (verifyPermissionFix) {
    await db.exec(
      await readFile(
        resolve(root, 'supabase/tests/remote/milestone_5b_permission_fix_verification.sql'),
        'utf8',
      ),
    );
    console.log('Permission-fix SQL verification passed without writer auth namespace access.');
  }
  if (verifyActivity) {
    await db.exec(
      await readFile(resolve(root, 'supabase/tests/remote/milestone_5b_verification.sql'), 'utf8'),
    );
    const result = await db.query(
      'select (select count(*) from public.activity_logs)::int as logs, (select count(*) from auth.users)::int as users, (select count(*) from public.planned_actions)::int as actions',
    );
    if (Object.values(result.rows[0]).some((count) => count !== 0))
      throw new Error('5B fixture rollback failed');
    console.log('5B SQL verification passed; fixtures and Activity Logs rolled back.');
  }

  if (generateTypes || checkTypes) {
    // Use the official Supabase generator and catalog introspection queries, not substitute types.
    const metaPackage = JSON.parse(
      await readFile(toolRequire.resolve('@supabase/postgres-meta/package.json'), 'utf8'),
    );
    if (metaPackage.version !== '0.95.2')
      throw new Error('This harness requires postgres-meta 0.95.2');
    const lib = pathToFileURL(
      resolve(dirname(toolRequire.resolve('@supabase/postgres-meta/package.json')), 'dist/lib/'),
    );
    const load = async (name) =>
      (await import(new URL(`PostgresMeta${name}.js`, lib.href + '/'))).default;
    const query = async (sql) => {
      try {
        return { data: (await db.query(sql)).rows, error: null };
      } catch (error) {
        return { data: null, error };
      }
    };
    const names = [
      'Schemas',
      'Tables',
      'ForeignTables',
      'Views',
      'MaterializedViews',
      'Columns',
      'Relationships',
      'Functions',
      'Types',
    ];
    const managers = await Promise.all(names.map(async (name) => new (await load(name))(query)));
    const schemaOptions = { includedSchemas: ['public'], includeColumns: false };
    const options = [
      undefined,
      schemaOptions,
      schemaOptions,
      schemaOptions,
      schemaOptions,
      schemaOptions,
      undefined,
      schemaOptions,
      { includeTableTypes: true, includeArrayTypes: true, includeSystemSchemas: true },
    ];
    const results = await Promise.all(
      managers.map((manager, index) => manager.list(options[index])),
    );
    results.forEach((result) => {
      if (result.error) throw result.error;
    });
    const [
      schemas,
      tables,
      foreignTables,
      views,
      materializedViews,
      columns,
      relationships,
      functions,
      types,
    ] = results.map((result) => result.data);
    const { apply } = await import(new URL('../server/templates/typescript.js', lib.href + '/'));
    const currentTypes = await readFile(
      resolve(root, 'src/services/supabase/database.types.ts'),
      'utf8',
    );
    const postgrestVersion = /PostgrestVersion:\s*"([^"]+)"/.exec(currentTypes)?.[1];
    if (!postgrestVersion) throw new Error('Missing generated PostgREST version');
    const output = await apply({
      schemas: schemas.filter((schema) => schema.name === 'public'),
      tables,
      foreignTables,
      views,
      materializedViews,
      columns,
      relationships,
      functions: functions.filter((fn) => !['trigger', 'event_trigger'].includes(fn.return_type)),
      types,
      detectOneToOneRelationships: true,
      postgrestVersion,
    });
    if (!output.includes('update_planned_action_status:')) throw new Error('Generated RPC missing');
    if (verifyActivity && !output.includes('activity_logs:'))
      throw new Error('Generated Activity Log table missing');
    if (checkTypes) {
      const projectRequire = createRequire(pathToFileURL(resolve(root, 'package.json')));
      const ts = projectRequire('typescript');
      const normalize = (source) =>
        ts
          .createPrinter({ removeComments: true })
          .printFile(
            ts.createSourceFile(
              'database.types.ts',
              source,
              ts.ScriptTarget.Latest,
              true,
              ts.ScriptKind.TS,
            ),
          );
      if (normalize(currentTypes) !== normalize(output))
        throw new Error('Local-generated public types differ from authoritative remote types');
      console.log(
        'Official generator check passed: public table/function types unchanged; remote-generated file preserved.',
      );
    } else {
      await writeFile(resolve(root, 'src/services/supabase/database.types.ts'), output, 'utf8');
      console.log(
        'Generated database.types.ts from the local catalog using Supabase postgres-meta 0.95.2.',
      );
    }
  }
} finally {
  await db.close();
}
