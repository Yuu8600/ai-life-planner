import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Explicit, localhost-only, fresh disposable Postgres. Never use a linked DB.
const toolsDirectory = process.argv[2];
const port = Number(process.argv[3]);
if (!toolsDirectory || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    'Usage: node scripts/verify-planned-action-concurrency-local.mjs <tools-directory> <disposable-local-port>',
  );
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolRequire = createRequire(pathToFileURL(resolve(toolsDirectory, 'package.json')));
const { Client } = toolRequire('pg');
const clients = Array.from(
  { length: 3 },
  () =>
    new Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: 'postgres',
      application_name: 'planner-disposable-lock-verification',
      connectionTimeoutMillis: 5000,
    }),
);
const [admin, first, second] = clients;
const connected = new Set();
const owner = '96000000-0000-4000-8000-000000000001';
const plan = '98000000-0000-4000-8000-000000000001';
const taskId = (n) => `97000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actionId = (n) => `99000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const exec = (client, id, status) =>
  client.query('select * from public.update_planned_action_status($1::uuid,$2)', [id, status]);
const auth = async (client) => {
  await client.query('begin isolation level read committed');
  await client.query("set local statement_timeout = '10s'");
  await client.query('set local role authenticated');
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
};
let setupComplete = false;
try {
  for (const client of clients) {
    await client.connect();
    connected.add(client);
  }
  assert.equal(
    (
      await admin.query(
        "select to_regclass('public.profiles') is null and not exists(select 1 from pg_namespace where nspname='auth') as fresh",
      )
    ).rows[0].fresh,
    true,
    'Refusing to touch a non-fresh DB',
  );
  await admin.query(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create role local_managed_auth_owner nologin;
    create schema auth authorization local_managed_auth_owner;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const filename of (await readdir(resolve(root, 'supabase/migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    if (filename === '20261104090000_fix_activity_log_trigger_permissions.sql') {
      await admin.query(
        await readFile(
          resolve(root, 'supabase/tests/local/activity_log_auth_namespace_regression.sql'),
          'utf8',
        ),
      );
    }
    await admin.query(await readFile(resolve(root, 'supabase/migrations', filename), 'utf8'));
    if (filename === '20261009090000_add_activity_logs.sql') {
      await admin.query('revoke usage on schema auth from ai_life_planner_activity_writer');
    }
  }
  for (const file of [
    'local/activity_log_reason_write_surface.sql',
    'remote/milestone_4d_verification.sql',
    'remote/milestone_5a_verification.sql',
    'remote/milestone_5b_permission_fix_verification.sql',
    'remote/milestone_5b_verification.sql',
  ]) {
    await admin.query(await readFile(resolve(root, 'supabase/tests', file), 'utf8'));
    console.log(`Real Postgres SQL passed: ${file}`);
  }
  assert.equal(
    (
      await admin.query(
        "select has_any_column_privilege('authenticated','public.planned_actions','UPDATE') as allowed",
      )
    ).rows[0].allowed,
    false,
  );
  const firstPid = (await first.query('select pg_backend_pid() as pid')).rows[0].pid;
  const secondPid = (await second.query('select pg_backend_pid() as pid')).rows[0].pid;
  assert.notEqual(firstPid, secondPid);
  const day = (await admin.query("select (now() at time zone 'Asia/Tokyo')::date::text as day"))
    .rows[0].day;
  await admin.query('insert into auth.users(id,email) values($1,$2)', [
    owner,
    'concurrency@example.invalid',
  ]);
  await admin.query(
    'insert into public.daily_plans(id,user_id,plan_date,timezone) values($1,$2,$3,$4)',
    [plan, owner, day, 'Asia/Tokyo'],
  );
  setupComplete = true;
  const fixture = async (n) => {
    await admin.query(
      "insert into public.tasks(id,user_id,title,estimated_minutes,priority,status) values($1,$2,'Concurrent fixture',30,'high','pending')",
      [taskId(n), owner],
    );
    await admin.query(
      "insert into public.planned_actions(id,user_id,daily_plan_id,task_id,title,start_at,end_at) values($1,$2,$3,$4,'Concurrent Action',now(),now()+interval '30 minutes')",
      [actionId(n), owner, plan, taskId(n)],
    );
  };
  const waitBlocked = async () => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const blockers = (await admin.query('select pg_blocking_pids($1) as blockers', [secondPid]))
        .rows[0].blockers;
      if (blockers.includes(firstPid)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error('Expected second independent connection to block on the first transaction');
  };
  const race = async (label, firstOperation, secondOperation, release, expectedError) => {
    await auth(first);
    await auth(second);
    try {
      await firstOperation();
      const pending = secondOperation().then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await waitBlocked();
      await first.query(release);
      const result = await pending;
      if (expectedError) {
        assert.equal(result.error?.code, expectedError, label);
        await second.query('rollback');
      } else {
        if (result.error) throw result.error;
        await second.query('commit');
      }
      console.log(`Concurrent case passed: ${label}`);
    } finally {
      await first.query('rollback');
      await second.query('rollback');
    }
  };
  const check = async (n, actionStatus, taskStatus, count, eventType) => {
    const result = (
      await admin.query(
        `select
      (select status from public.planned_actions where id=$1) as action_status,
      (select status from public.tasks where id=$2) as task_status,
      (select count(*)::int from public.activity_logs where planned_action_id=$1) as logs,
      (select min(event_type) from public.activity_logs where planned_action_id=$1) as event_type`,
        [actionId(n), taskId(n)],
      )
    ).rows[0];
    assert.equal(result.action_status, actionStatus);
    assert.equal(result.task_status, taskStatus);
    assert.equal(result.logs, count);
    assert.equal(result.event_type, eventType);
  };
  await fixture(1);
  await race(
    'Complete + Complete → one Log, second is no-op',
    () => exec(first, actionId(1), 'completed'),
    () => exec(second, actionId(1), 'completed'),
    'commit',
  );
  await check(1, 'completed', 'completed', 1, 'planned_action_completed');
  await fixture(2);
  await race(
    'Complete + Skip → second rejected after lock',
    () => exec(first, actionId(2), 'completed'),
    () => exec(second, actionId(2), 'skipped'),
    'commit',
    '22023',
  );
  await check(2, 'completed', 'completed', 1, 'planned_action_completed');
  await fixture(3);
  await race(
    'Skip + Complete → second rejected, Task pending',
    () => exec(first, actionId(3), 'skipped'),
    () => exec(second, actionId(3), 'completed'),
    'commit',
    '22023',
  );
  await check(3, 'skipped', 'pending', 1, 'planned_action_skipped');
  await fixture(4);
  await race(
    'Complete rolled back + Skip → fresh scheduled state used',
    () => exec(first, actionId(4), 'completed'),
    () => exec(second, actionId(4), 'skipped'),
    'rollback',
  );
  await check(4, 'skipped', 'pending', 1, 'planned_action_skipped');
  await fixture(5);
  await fixture(6);
  await race(
    'different Actions of one Plan → same lock order, both valid',
    () => exec(first, actionId(5), 'completed'),
    () => exec(second, actionId(6), 'completed'),
    'commit',
  );
  await check(5, 'completed', 'completed', 1, 'planned_action_completed');
  await check(6, 'completed', 'completed', 1, 'planned_action_completed');
  const replace = (client) =>
    client.query(
      "select * from public.replace_daily_plan($1::date,'Asia/Tokyo','Concurrent replace','[]'::jsonb)",
      [day],
    );
  await fixture(7);
  await race(
    'replacement + Execution → deleted Action rejected',
    () => replace(first),
    () => exec(second, actionId(7), 'completed'),
    'commit',
    'P0002',
  );
  await check(7, null, 'pending', 0, null);
  await fixture(8);
  await race(
    'Execution + replacement → completed Task/Log retained',
    () => exec(first, actionId(8), 'completed'),
    () => replace(second),
    'commit',
  );
  await check(8, null, 'completed', 1, 'planned_action_completed');
  await fixture(9);
  await auth(first);
  await exec(first, actionId(9), 'completed');
  await first.query('commit');
  await race(
    'replacement + final-status replay → no stale unlocked no-op',
    () => replace(first),
    () => exec(second, actionId(9), 'completed'),
    'commit',
    'P0002',
  );
  await check(9, null, 'completed', 1, 'planned_action_completed');
  console.log('All 8 independent-connection concurrency cases passed at READ COMMITTED.');
} finally {
  try {
    for (const client of [first, second, admin].filter((client) => connected.has(client))) {
      try {
        await client.query('rollback');
      } catch {
        /* disconnected/failed setup */
      }
    }
    if (setupComplete) {
      await admin.query('delete from auth.users where id=$1', [owner]);
      const remaining = (
        await admin.query(`select (select count(*) from auth.users)::int as users,
        (select count(*) from public.tasks)::int as tasks,
        (select count(*) from public.planned_actions)::int as actions,
        (select count(*) from public.activity_logs)::int as logs`)
      ).rows[0];
      assert.ok(
        Object.values(remaining).every((count) => count === 0),
        'Disposable fixture cleanup failed',
      );
      console.log('All committed local concurrency fixtures cleaned up.');
    }
  } finally {
    await Promise.all([...connected].map((client) => client.end().catch(() => {})));
  }
}
