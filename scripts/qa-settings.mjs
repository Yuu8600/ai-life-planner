import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../', import.meta.url));
export const qaRoot = join(homedir(), 'Library/Application Support/AI Life Planner/qa');
export const qaId = 'ai-life-planner-v27-qa';
export const qaUrl = 'http://127.0.0.1:56821';
export const cli = join(repo, 'node_modules/.bin/supabase');

export function requireQa() {
  const config = readFileSync(join(qaRoot, 'supabase/config.toml'), 'utf8');
  if (
    !/^project_id = "ai-life-planner-v27-qa"$/m.test(config) ||
    !/^\[api\]\n[^[]*?^port = 56821$/m.test(config) ||
    !/^\[db\]\n[^[]*?^port = 56822$/m.test(config) ||
    existsSync(join(qaRoot, 'supabase/.temp/project-ref'))
  )
    throw new Error('共通QAのID・ポート・クラウドリンクを確認してください。');
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(
      `${args[0]} に失敗しました（${result.error?.code ?? result.status ?? result.signal}）。`,
    );
  }
  return result.stdout;
}

export function qaCli(args) {
  requireQa();
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^(SUPABASE_|(?:V2_)?OPENAI_)/.test(name)),
  );
  return run(cli, args, { cwd: qaRoot, env });
}

export function qaPublicKey() {
  const info = JSON.parse(qaCli(['status', '-o', 'json']));
  const apiUrl = new URL(info.API_URL);
  if (!['localhost', '127.0.0.1'].includes(apiUrl.hostname) || apiUrl.port !== '56821')
    throw new Error('共通QAのAPI接続先が一致しません。');
  return info.PUBLISHABLE_KEY || info.ANON_KEY;
}
