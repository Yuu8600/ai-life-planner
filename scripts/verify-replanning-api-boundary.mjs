import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Anonymous Data API configuration probe only. No JWT, credential output or Planner execution.
const source = await readFile(new URL('../.env', import.meta.url), 'utf8');
function envValue(name) {
  const match = source.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
}
const base = envValue('EXPO_PUBLIC_SUPABASE_URL');
const key = envValue('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const response = await fetch(new URL('/rest/v1/rpc/lock_replan_if_current', base), {
  method: 'POST',
  headers: {
    apikey: key,
    'Content-Type': 'application/json',
    'Content-Profile': 'planner_execution_private',
  },
  body: JSON.stringify({ p_plan_date: '2000-01-01', p_expected_snapshot: {}, p_actions: [] }),
  signal: AbortSignal.timeout(10000),
});
const body = await response.json();
assert.equal(body.code, 'PGRST106', 'Private schema must not be exposed through the Data API');
console.log(
  JSON.stringify({ privateSchemaExcluded: true, httpStatus: response.status, code: body.code }),
);
