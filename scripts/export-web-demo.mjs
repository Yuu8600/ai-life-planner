import { spawnSync } from 'node:child_process';

// Do not read the developer's .env or inject EXPO_PUBLIC_* into the public demo.
const result = spawnSync(process.execPath, ['node_modules/expo/bin/cli', 'export', '-p', 'web'], {
  stdio: 'inherit',
  env: { ...process.env, GITHUB_PAGES: '1', EXPO_NO_DOTENV: '1', EXPO_NO_CLIENT_ENV_VARS: '1' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
