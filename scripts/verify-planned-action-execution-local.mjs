import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Optional test tools live OUTSIDE the app dependency tree. No network or remote DB access.
const toolsDirectory = process.argv[2];
const generateTypes = process.argv[3] === '--generate-types';
if (!toolsDirectory || (process.argv[3] && !generateTypes)) {
  console.error(
    'Usage: node scripts/verify-planned-action-execution-local.mjs <tools-directory> [--generate-types]',
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
  const migrationsDirectory = resolve(root, 'supabase/migrations');
  for (const filename of (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(await readFile(resolve(migrationsDirectory, filename), 'utf8'));
    console.log('Applied local migration: ' + filename);
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

  if (generateTypes) {
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
      postgrestVersion: '14.5',
    });
    if (!output.includes('update_planned_action_status:')) throw new Error('Generated RPC missing');
    await writeFile(resolve(root, 'src/services/supabase/database.types.ts'), output, 'utf8');
    console.log(
      'Generated database.types.ts from the local catalog using Supabase postgres-meta 0.95.2.',
    );
  }
} finally {
  await db.close();
}
