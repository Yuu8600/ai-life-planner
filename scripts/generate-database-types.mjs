import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const generationMode = process.argv[2];

if (generationMode !== '--local' && generationMode !== '--linked') {
  console.error('Usage: generate-database-types.mjs --local|--linked');
  process.exit(1);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const cliEntry = resolve(projectRoot, 'node_modules', 'supabase', 'dist', 'supabase.js');

if (!existsSync(cliEntry)) {
  console.error('Supabase CLIが見つかりません。先にnpm installを実行してください。');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [cliEntry, 'gen', 'types', generationMode, '--schema', 'public'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: false,
  },
);

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? 'Supabase database型の生成に失敗しました。');
  process.exit(result.status ?? 1);
}

if (!result.stdout.trim()) {
  console.error('Supabase CLIからDatabase型が返されなかったため、既存ファイルを保持します。');
  process.exit(1);
}

const outputPath = resolve(projectRoot, 'src', 'services', 'supabase', 'database.types.ts');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, result.stdout, 'utf8');
console.log(`Generated ${outputPath}`);
