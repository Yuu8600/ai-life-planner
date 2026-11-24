import {
  chmodSync,
  closeSync,
  cpSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { qaCli, qaId, qaPublicKey, qaRoot, qaUrl, repo, requireQa, run } from './qa-settings.mjs';

const database = `supabase_db_${qaId}`;
const serviceExclusions =
  'studio,storage-api,imgproxy,postgres-meta,realtime,logflare,vector,supavisor';

try {
  requireQa();
  const command = process.argv[2];
  if (command === 'start' || command === 'restart') {
    if (command === 'restart') qaCli(['stop', '--project-id', qaId]);
    qaCli(['start', '-x', serviceExclusions]);
    qaPublicKey();
    console.log(`共通QAを起動しました。API ${qaUrl}、DB 56822`);
  } else if (command === 'stop') {
    qaCli(['stop', '--project-id', qaId]);
    console.log('共通QAを停止しました。Dockerボリュームは保持しています。');
  } else if (command === 'status') {
    qaPublicKey();
    const result = await fetch(`${qaUrl}/functions/v1/v2-chat`, {
      signal: AbortSignal.timeout(5000),
    });
    if (result.status !== 401)
      throw new Error(`共通QAの v2-chat が想定外の応答を返しました（HTTP ${result.status}）。`);
    console.log(`共通QAは稼働中です。API ${qaUrl}、DB 56822、v2-chat 応答あり（認証必須）`);
  } else if (command === 'apply') {
    const sandbox = join(qaRoot, 'supabase');
    cpSync(join(repo, 'supabase/migrations'), join(sandbox, 'migrations'), { recursive: true });
    qaCli(['migration', 'up', '--local']);
    cpSync(join(repo, 'supabase/functions'), join(sandbox, 'functions'), {
      recursive: true,
      filter: (source) => !/(^|\/)\.env(?:\.|$)/.test(source),
    });
    console.log('共通QAに未適用のマイグレーションを反映し、Edgeソースを同期しました。');
  } else if (command === 'backup') {
    const dir = mkdtempSync(join(qaRoot, 'backups/qa-'));
    chmodSync(dir, 0o700);
    const dump = join(dir, 'qa.dump');
    const file = openSync(dump, 'wx', 0o600);
    try {
      run('docker', ['exec', database, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc'], {
        stdio: ['ignore', file, 'pipe'],
      });
    } finally {
      closeSync(file);
    }
    const listing = run('docker', ['exec', '-i', database, 'pg_restore', '--list'], {
      input: readFileSync(dump),
    });
    if (
      !listing.includes('TABLE DATA auth users ') ||
      !listing.includes('TABLE DATA public tasks ')
    )
      throw new Error('バックアップに必要なテーブルがありません。');
    const digest = createHash('sha256').update(readFileSync(dump)).digest('hex');
    writeFileSync(join(dir, 'sha256.txt'), `${digest}  qa.dump\n`, { mode: 0o600 });
    console.log(`共通QAバックアップを作成しました。 ${dir}`);
  } else {
    throw new Error(
      'start / stop / restart / status / apply / backup のいずれかを指定してください。',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : '共通QAの操作に失敗しました。');
  process.exitCode = 1;
}
