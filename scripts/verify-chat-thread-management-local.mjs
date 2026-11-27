import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { qaId, repo, requireQa } from './qa-settings.mjs';

requireQa();
if (process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith('unix://'))
  throw new Error('ローカルDockerのQAだけを対象にしてください。');
const context = spawnSync('docker', ['context', 'inspect'], { encoding: 'utf8' });
if (
  context.status !== 0 ||
  !JSON.parse(context.stdout)[0]?.Endpoints?.docker?.Host?.startsWith('unix://')
)
  throw new Error('ローカルDockerの接続先を確認できません。');
const args = [
  'exec',
  '-i',
  `supabase_db_${qaId}`,
  'psql',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
  '-q',
];
function check(name) {
  const result = spawnSync('docker', args, {
    input: readFileSync(join(repo, 'supabase/tests/local', `${name}.sql`)),
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr}`);
  console.log(`${name}: PASS (rolled back)`);
}
for (const name of [
  'chat_thread_management',
  'v26_ai_calendar',
  'v27_calendar_policy_approval',
  'v27_batch_task_actions',
])
  check(name);

const lock = spawn('docker', [...args, '-At'], { stdio: ['pipe', 'pipe', 'pipe'] });
let output = '',
  failure = '';
lock.stdout.on('data', (data) => {
  output += data.toString();
});
lock.stderr.on('data', (data) => {
  failure += data.toString();
});
const done = new Promise((resolve, reject) => {
  lock.on('error', reject);
  lock.on('close', (code) =>
    code === 0 ? resolve() : reject(new Error(failure || 'Lock session failed')),
  );
});
// Attach a handler immediately so startup failures cannot be unhandled rejections.
void done.catch(() => {});
const ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Reservation lock did not start')), 4000);
  lock.stdout.on('data', () => {
    if (output.includes('LOCK_READY')) {
      clearTimeout(timeout);
      resolve();
    }
  });
  lock.on('error', (error) => {
    clearTimeout(timeout);
    reject(error);
  });
});
lock.stdin.end(
  "begin; set local statement_timeout='5s'; select pg_advisory_xact_lock(hashtextextended('fe2c0010-0000-4000-8000-000000000001',3)); select 'LOCK_READY'; select pg_sleep(2); rollback;",
);
try {
  await ready;
  check('chat_thread_management_lock');
} finally {
  await done;
}
