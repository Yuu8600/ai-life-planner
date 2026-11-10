import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = '/ai-life-planner';
await fs.access('dist/.nojekyll');
await fs.access('dist/favicon.ico');
for (const route of ['index', 'goals', 'tasks', 'calendar', 'ai', 'today', 'settings', 'login']) {
  const html = await fs.readFile(`dist/${route}.html`, 'utf8');
  assert.match(html, /lang="ja"/);
  assert(
    html.includes(`<link rel="icon" href="${baseUrl}/favicon.ico"`),
    `Missing or unprefixed favicon: ${route}`,
  );
  for (const [, resource] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!resource.startsWith('/')) continue;
    assert(resource.startsWith(`${baseUrl}/`), `Unprefixed resource: ${resource}`);
    if (resource.includes('/_expo/') || resource.includes('/assets/')) {
      await fs.access(path.join('dist', resource.slice(baseUrl.length)));
    }
  }
}
const bundles = await fs.readdir('dist/_expo/static/js/web');
assert(bundles.some((file) => file.endsWith('.js')));
for (const file of bundles.filter((name) => name.endsWith('.js'))) {
  const source = await fs.readFile(path.join('dist/_expo/static/js/web', file), 'utf8');
  for (const forbidden of [
    'EXPO_PUBLIC_SUPABASE',
    'getCalendarPermissions',
    'OPENAI_API_KEY',
    'service_role',
    'supabase.co',
  ]) {
    assert(
      !source.includes(forbidden),
      `Native/server integration leaked into web bundle: ${forbidden}`,
    );
  }
}
console.log(
  'Pages export verified: routes, baseUrl, assets, favicon, Japanese HTML, .nojekyll and integration isolation.',
);
