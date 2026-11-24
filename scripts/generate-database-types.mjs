import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qaCli } from './qa-settings.mjs';

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

let types;
try {
  if (generationMode === '--local') {
    types = qaCli(['gen', 'types', '--local', '--schema', 'public']);
  } else {
    const result = spawnSync(
      process.execPath,
      [cliEntry, 'gen', 'types', '--linked', '--schema', 'public'],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        shell: false,
      },
    );
    if (result.error || result.status !== 0)
      throw new Error('リンク先からDatabase型を生成できませんでした。');
    types = result.stdout;
  }
  if (!types?.trim()) throw new Error('Database型が返されませんでした。');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const outputPath = resolve(projectRoot, 'src', 'services', 'supabase', 'database.types.ts');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, types, 'utf8');
console.log(`Generated ${outputPath}`);
