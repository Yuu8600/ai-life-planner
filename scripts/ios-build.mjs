import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cli, qaPublicKey, qaRoot, qaUrl, repo, run } from './qa-settings.mjs';

const dailyBundleId = 'com.uyu.ailifeplanner';
const qaBundleId = `${dailyBundleId}.v27qa`;
const migrationSql = `
select count(*) = 8 as ready
from supabase_migrations.schema_migrations
where version in (
 '20261114090000', '20261114100000', '20261118100000', '20261118110000',
 '20261118120000', '20261118130000', '20261122100000', '20261123100000'
)
and to_regprocedure('public.v27_approve_calendar_policies(uuid,uuid,jsonb)') is not null
and to_regprocedure('public.v27_undo_daily_results(date,jsonb)') is not null
and to_regprocedure('public.v27_delete_completed_tasks(uuid[])') is not null
`;

async function cloudTarget() {
  const file = readFileSync(join(qaRoot, 'iphone-cloud.env'), 'utf8');
  const settings = Object.fromEntries(
    file
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
      .map((line) => {
        const match = /^([A-Z_]+)=([^\s]+)$/.exec(line.trim());
        if (!match) throw new Error('iPhoneクラウド設定の書式が不正です。');
        return [match[1], match[2]];
      }),
  );
  const ref = settings.ALP_CLOUD_PROJECT_REF;
  const url = settings.EXPO_PUBLIC_SUPABASE_URL;
  const key = settings.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!/^[a-z0-9]{20}$/.test(ref ?? '') || url !== `https://${ref}.supabase.co`)
    throw new Error('iPhoneクラウド設定のプロジェクトとURLが一致しません。');
  console.log(`iPhone用クラウド ${url} / ${dailyBundleId}`);
  await verifyPublicKey(url, key);

  const linkedRef = readFileSync(join(repo, 'supabase/.temp/project-ref'), 'utf8').trim();
  if (linkedRef !== ref) throw new Error('固定したクラウドとCLIのリンク先が一致しません。');
  const report = JSON.parse(
    run(cli, ['db', 'query', '--linked', '-o', 'json', migrationSql], { cwd: repo }),
  );
  const rows = Array.isArray(report) ? report : report.rows;
  if (rows?.[0]?.ready !== true)
    throw new Error('クラウドDBはV2.7に未対応です。実機ビルドを中止しました。');
  const functions = JSON.parse(
    run(cli, ['functions', 'list', '--project-ref', ref, '-o', 'json'], { cwd: repo }),
  );
  if (
    !functions.some(
      (entry) =>
        entry.slug === 'v2-chat' && entry.status === 'ACTIVE' && entry.verify_jwt === false,
    )
  )
    throw new Error('クラウドの v2-chat 配備状態を確認できません。実機ビルドを中止しました。');
  return { url, key };
}

async function verifyPublicKey(url, key) {
  if (!key?.startsWith('sb_publishable_')) {
    let role;
    try {
      role = JSON.parse(Buffer.from(key?.split('.')[1] ?? '', 'base64url').toString()).role;
    } catch {
      // Only Supabase publishable keys and legacy anon keys are accepted.
    }
    if (role !== 'anon') throw new Error('公開用キーを設定してください。');
  }
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(`URLと公開用キーの組を確認できません（HTTP ${response.status}）。`);
}

function buildEnv({ url, key }) {
  for (const name of ['.xcode.env', '.xcode.env.local', '.xcode.env.updates']) {
    const file = join(repo, 'ios', name);
    if (
      existsSync(file) &&
      /EXPO_(?:PUBLIC_|NO_DOTENV|NO_CLIENT_ENV_VARS)/.test(readFileSync(file, 'utf8'))
    )
      throw new Error(`ios/${name} に接続先の上書きがあるためビルドを中止しました。`);
  }
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !/^(SUPABASE_|(?:V2_)?OPENAI_|EXPO_PUBLIC_|EXPO_NO_CLIENT_ENV_VARS$)/.test(name),
    ),
  );
  return {
    ...env,
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  };
}

function qaBuild(target) {
  const inventory = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']));
  const booted = Object.entries(inventory.devices)
    .filter(([runtime]) => runtime.includes('.iOS-'))
    .flatMap(([, devices]) => devices.filter((device) => device.state === 'Booted'));
  if (booted.length !== 1) throw new Error('対象のiOS Simulatorを1台だけ起動してください。');
  const id = booted[0].udid;
  const derived = join(qaRoot, 'DerivedData');
  run(
    'xcodebuild',
    [
      '-workspace',
      'ios/AILifePlanner.xcworkspace',
      '-scheme',
      'AILifePlanner',
      '-configuration',
      'Release',
      '-destination',
      `platform=iOS Simulator,id=${id}`,
      '-derivedDataPath',
      derived,
      '-jobs',
      '4',
      'CODE_SIGNING_ALLOWED=NO',
      '-quiet',
    ],
    { cwd: repo, env: buildEnv(target), stdio: 'inherit' },
  );

  const source = join(derived, 'Build/Products/Release-iphonesimulator/AILifePlanner.app');
  const bundle = readFileSync(join(source, 'main.jsbundle'));
  if (!bundle.includes(target.url) || !bundle.includes(target.key))
    throw new Error('ビルド成果物から共通QAの接続設定を確認できません。');
  const app = join(mkdtempSync(join(qaRoot, 'simulator-')), 'AILifePlanner-QA.app');
  run('ditto', [source, app]);
  const plist = join(app, 'Info.plist');
  for (const [name, value] of [
    ['CFBundleIdentifier', qaBundleId],
    ['CFBundleDisplayName', 'AI Life Planner QA'],
    ['CFBundleURLTypes:0:CFBundleURLSchemes:0', 'ailifeplannerv27qa'],
    ['CFBundleURLTypes:0:CFBundleURLSchemes:1', qaBundleId],
    ['CFBundleURLTypes:1:CFBundleURLSchemes:0', 'exp+ai-life-planner-v27qa'],
  ]) {
    run('/usr/libexec/PlistBuddy', ['-c', `Set :${name} ${value}`, plist]);
  }
  const manifestPath = join(app, 'EXConstants.bundle/app.config');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.scheme = 'ailifeplannerv27qa';
  manifest.ios.bundleIdentifier = qaBundleId;
  writeFileSync(manifestPath, JSON.stringify(manifest));
  run('codesign', ['--force', '--deep', '--sign', '-', app]);
  run('codesign', ['--verify', '--deep', '--strict', app]);
  run('xcrun', ['simctl', 'install', id, app]);
  run('xcrun', ['simctl', 'launch', id, qaBundleId]);
  console.log(`共通QAビルドを ${booted[0].name} にインストールしました。`);
}

function cloudBuild(target) {
  const devices = JSON.parse(run('xcrun', ['xcdevice', 'list', '--timeout', '7']));
  const iphones = devices.filter(
    (device) =>
      device.available &&
      !device.simulator &&
      device.platform === 'com.apple.platform.iphoneos' &&
      device.modelName?.startsWith('iPhone'),
  );
  if (iphones.length !== 1)
    throw new Error('対象のiPhoneを1台だけMacに接続し、ロックを解除してください。');
  const settings = run(
    'xcodebuild',
    [
      '-workspace',
      'ios/AILifePlanner.xcworkspace',
      '-scheme',
      'AILifePlanner',
      '-configuration',
      'Release',
      '-destination',
      `id=${iphones[0].identifier}`,
      '-showBuildSettings',
    ],
    { cwd: repo, env: buildEnv(target) },
  );
  if (!settings.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${dailyBundleId}\n`))
    throw new Error('実機用XcodeターゲットのアプリIDを確認できません。');
  run(
    process.execPath,
    [
      'node_modules/expo/bin/cli',
      'run:ios',
      '--configuration',
      'Release',
      '--device',
      iphones[0].identifier,
      '--no-bundler',
    ],
    { cwd: repo, env: buildEnv(target), stdio: 'inherit' },
  );
}

try {
  const [mode, flag, ...rest] = process.argv.slice(2);
  if (!['qa', 'cloud'].includes(mode) || (flag !== undefined && flag !== '--check') || rest.length)
    throw new Error(
      '使用法は npm run ios:qa または npm run ios:cloud（確認だけなら -- --check）です。',
    );
  const target = mode === 'qa' ? { url: qaUrl, key: qaPublicKey() } : await cloudTarget();
  if (mode === 'qa') {
    console.log(`Simulator用共通QA ${target.url} / ${qaBundleId}`);
    await verifyPublicKey(target.url, target.key);
  }
  if (flag === '--check') console.log('接続先の確認に成功しました。');
  else if (mode === 'qa') qaBuild(target);
  else cloudBuild(target);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'iOSビルドの準備に失敗しました。');
  process.exitCode = 1;
}
