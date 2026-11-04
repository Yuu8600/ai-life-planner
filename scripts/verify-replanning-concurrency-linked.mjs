import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicitly approved, bounded remote verification. Fixed synthetic owner only.
// No credentials are read/output: each connection is made through the linked CLI.
if (process.argv[2] !== '--linked-approved') throw new Error('Requires --linked-approved');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(join(tmpdir(), 'ai-life-planner-5c-remote-'));
const owner = 'b1000000-0000-4000-8000-000000000001';
const plan = 'b3000000-0000-4000-8000-000000000001';
const control = 'b2000000-0000-4000-8000-000000000099';
const task = (n) => `b2000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const action = (n) => `b4000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const day = "(now() at time zone 'Asia/Tokyo')::date";
const identity = `set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true);`;
const runId = `alp5c-${Date.now()}`;
let sequence = 0;
let created = false;
async function query(sql) {
  const path = join(temporary, `${++sequence}.sql`);
  await writeFile(path, sql, 'utf8');
  return new Promise((resolveQuery, reject) => {
    const child = spawn(
      process.execPath,
      [
        resolve(root, 'node_modules/supabase/dist/supabase.js'),
        'db',
        'query',
        '--linked',
        '--file',
        path,
      ],
      { cwd: root, windowsHide: true, shell: false },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0)
        return reject(new Error(`Linked query failed: ${stderr}\n${stdout.slice(0, 1800)}`));
      try {
        resolveQuery(JSON.parse(stdout.slice(stdout.indexOf('{'))).rows);
      } catch {
        reject(new Error('Unexpected linked query result; raw output intentionally withheld.'));
      }
    });
  });
}
const release = (n) =>
  query(`begin; set local statement_timeout='5s'; ${identity}
  update public.tasks set title='release-${n}' where id='${control}' and user_id='${owner}'; commit; select true as released;`);
try {
  created = true; // Cleanup is restricted to the unique run marker, including lost replies.
  await query(`begin; set local statement_timeout='10s';
    do $$begin
      if exists(select 1 from auth.users where id='${owner}')
        or exists(select 1 from public.profiles where id='${owner}')
        or exists(select 1 from public.daily_plans where user_id='${owner}')
        or exists(select 1 from public.tasks where user_id='${owner}')
        or exists(select 1 from public.planned_actions where user_id='${owner}')
        or exists(select 1 from public.activity_logs where user_id='${owner}') then
        raise exception 'Refusing existing fixture identity'; end if;
    end$$;
    insert into auth.users(id,email,raw_user_meta_data) values('${owner}','m5c-remote-concurrency@example.invalid',jsonb_build_object('verification_run','${runId}'));
    insert into public.daily_plans(id,user_id,plan_date,timezone,summary) values('${plan}','${owner}',${day},'Asia/Tokyo','Remote concurrency fixture');
    insert into public.tasks(id,user_id,title,estimated_minutes,priority,status)
      select ('b2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${owner}','Remote fixture',30,'high','pending' from generate_series(1,5) n;
    insert into public.tasks(id,user_id,title,estimated_minutes,priority,status) values('${control}','${owner}','hold',1,'low','pending');
    commit; select true as fixture_created;`);
  const kinds = ['complete', 'skip', 'replace', 'task', 'past-time'];
  for (let index = 0; index < kinds.length; index++) {
    const n = index + 1;
    const kind = kinds[index];
    const rows = await query(`begin; set local statement_timeout='10s'; ${identity}
      delete from public.planned_actions where daily_plan_id='${plan}' and user_id='${owner}';
      update public.daily_plans set summary='Case ${n}' where id='${plan}' and user_id='${owner}';
      update public.tasks set title='hold' where id='${control}';
      insert into public.planned_actions(id,user_id,daily_plan_id,task_id,title,start_at,end_at)
      values('${action(n)}','${owner}','${plan}','${task(n)}','Remote old Action',clock_timestamp()-interval '1 hour',clock_timestamp()-interval '30 minutes');
      select public.get_daily_plan_snapshot(${day}) as snapshot;
      commit;`);
    const expected = rows.find((row) => row.snapshot)?.snapshot;
    assert.ok(expected, 'Missing owned snapshot');
    const expectedLiteral = JSON.stringify(expected).replaceAll("'", "''");
    const firstName = `${runId}-${n}-a`;
    const secondName = `${runId}-${n}-b`;
    const firstOperation =
      kind === 'complete' || kind === 'skip'
        ? `select * from public.update_planned_action_status('${action(n)}','${kind === 'complete' ? 'completed' : 'skipped'}');`
        : kind === 'replace'
          ? `select * from public.replace_daily_plan(${day},'Asia/Tokyo','Concurrent winner','[]');`
          : kind === 'task'
            ? `update public.tasks set status='completed' where id='${task(n)}';`
            : `select id from public.daily_plans where id='${plan}' and user_id='${owner}' for update;`;
    const first =
      query(`begin; set local application_name='${firstName}'; set local statement_timeout='40s'; ${identity}
      ${firstOperation}
      do $$declare deadline timestamptz := clock_timestamp()+interval '35 seconds'; begin loop
        exit when (select title from public.tasks where id='${control}')='release-${n}';
        if clock_timestamp()>deadline then raise exception 'Remote fixture release timed out'; end if;
        perform pg_sleep(0.1);
      end loop; end$$;
      commit; select true as first_committed;`).then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
    let second;
    try {
      // Verify A is holding its transaction before launching B.
      let started = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const state = await query(
          `select exists(select 1 from pg_stat_activity where application_name='${firstName}') as started;`,
        );
        if (state[0]?.started) {
          started = true;
          break;
        }
      }
      assert.ok(started, 'First independent transaction did not appear');
      second =
        query(`begin; set local application_name='${secondName}'; set local statement_timeout='30s'; ${identity}
        select * from public.replace_daily_plan_if_current(${day},'Asia/Tokyo','Must reject',
          jsonb_build_array(jsonb_build_object('task_id','${task(n)}','title','Remote new Action','reason','Fixture',
          'start_at',clock_timestamp()+interval '${kind === 'past-time' ? '1 second' : '1 hour'}',
          'end_at',clock_timestamp()+interval '90 minutes')),'${expectedLiteral}'::jsonb);
        commit;`).then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      let blocked = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        const state =
          await query(`select exists(select 1 from pg_stat_activity a, pg_stat_activity b
          where a.application_name='${firstName}' and b.application_name='${secondName}'
          and a.pid=any(pg_blocking_pids(b.pid))) as blocked;`);
        if (state[0]?.blocked) {
          blocked = true;
          break;
        }
      }
      assert.ok(blocked, 'No independently blocked remote transaction observed');
      if (kind === 'past-time') await new Promise((resolveDelay) => setTimeout(resolveDelay, 1100));
      await release(n);
      const [a, b] = await Promise.all([first, second]);
      if (a.error) throw a.error;
      assert.match(
        b.error?.message ?? '',
        /P5C01/,
        'Expected dedicated stale SQLSTATE after lock wait',
      );
      const result = (
        await query(`select
        (select status from public.planned_actions where id='${action(n)}' and user_id='${owner}') as action_status,
        (select status from public.tasks where id='${task(n)}' and user_id='${owner}') as task_status,
        (select summary from public.daily_plans where id='${plan}' and user_id='${owner}') as summary,
        (select count(*)::int from public.planned_actions where user_id='${owner}' and title='Remote new Action') as inserted,
        (select count(*)::int from public.activity_logs where user_id='${owner}' and planned_action_id='${action(n)}') as logs;`)
      )[0];
      assert.equal(result.inserted, 0);
      assert.equal(
        result.action_status,
        kind === 'replace'
          ? null
          : kind === 'complete'
            ? 'completed'
            : kind === 'skip'
              ? 'skipped'
              : 'scheduled',
      );
      assert.equal(
        result.task_status,
        kind === 'complete' || kind === 'task' ? 'completed' : 'pending',
      );
      assert.equal(result.logs, kind === 'complete' || kind === 'skip' ? 1 : 0);
      assert.equal(result.summary, kind === 'replace' ? 'Concurrent winner' : `Case ${n}`);
      console.log(`Remote blocked race passed: ${kind}; stale P5C01, no partial replacement.`);
    } finally {
      await release(n).catch(() => {});
      await Promise.allSettled([first, second].filter(Boolean));
    }
  }
} finally {
  try {
    if (created) {
      const counts = await query(`begin; set local statement_timeout='10s';
        delete from auth.users where id='${owner}' and email='m5c-remote-concurrency@example.invalid'
          and raw_user_meta_data->>'verification_run'='${runId}';
        commit;
        select (select count(*)::int from auth.users where id='${owner}') as users,
        (select count(*)::int from public.profiles where id='${owner}') as profiles,
        (select count(*)::int from public.tasks where user_id='${owner}') as tasks,
        (select count(*)::int from public.daily_plans where user_id='${owner}') as plans,
        (select count(*)::int from public.planned_actions where user_id='${owner}') as actions,
        (select count(*)::int from public.activity_logs where user_id='${owner}') as logs;`);
      assert.ok(
        Object.values(counts[0]).every((count) => count === 0),
        'Remote fixture cleanup incomplete',
      );
      console.log('Remote fixture users/profiles/tasks/plans/actions/logs: all zero.');
    }
  } finally {
    assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
    assert.ok(basename(temporary).startsWith('ai-life-planner-5c-remote-'));
    await rm(temporary, { recursive: true, force: true });
  }
}
