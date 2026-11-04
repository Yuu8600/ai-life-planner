# Milestone 5B — Activity Log / Execution History

> Current remote status (2026-11-04): the approved permission fix is applied and remote
> permission/5A/5B/4D verification has PASSED. The old auth namespace 42501 is resolved. All fixture
> groups and temporary verification functions/triggers were cleaned up. Android manual verification
> is not performed because an authenticated Emulator session could not be confirmed. No commit/5C.

The [permission repair and remote completion record](milestone-5b-permission-fix.md) removes auth
dependency from the logger and all authenticated Action UPDATE rights while retaining the public
INVOKER RPC. The earlier failed remote attempt below is historical and has now been repaired.

## Scope and architecture review

5A's `update_planned_action_status()` performs ownership checks and locks the Plan, Action and
linked Task. Complete changes the Action and linked Task atomically; Skip changes only the Action.
Final-status replays are no-ops, and other final transitions/Undo are rejected. The Execution use
case and write repository remain unchanged. `TodayRepository` remains read-only.

`replace_daily_plan()` deletes the old Actions and inserts new scheduled Actions. Consequently,
history cannot depend on a surviving Action or a JOIN to the current Task/Plan. Requirements F07
and the draft `activity_logs` model establish the naming/purpose; 5B implements only two Action
execution events, not `actual_minutes`, Task/Goal edits or generic event storage. The requirements
document itself is unchanged.

## Schema and event semantics

New migration: `20261009090000_add_activity_logs.sql`. No existing migration or RPC was edited.

`activity_logs` contains:

| Column                                   | Meaning                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `id`                                     | DB-generated event UUID                                             |
| `user_id`                                | Owner derived from the stored Plan and checked against `auth.uid()` |
| `event_type`                             | `planned_action_completed` or `planned_action_skipped` only         |
| `occurred_at`                            | DB `clock_timestamp()` absolute instant                             |
| `planned_action_id`, `task_id`           | Nullable immutable UUID reference snapshots, deliberately not FKs   |
| `plan_date`, `timezone`                  | Original Plan date and timezone snapshots                           |
| `action_title`                           | Action title at the transition                                      |
| `scheduled_start_at`, `scheduled_end_at` | Scheduled absolute instants at the transition                       |

Action/Task references are not FKs so deletion/replacement neither deletes the Log nor rewrites its
reference fields. Display needs no joins. Deleting the Plan also leaves history intact. The owner
FK to `profiles` intentionally cascades on profile/account erasure; this is not an exposed history
edit/delete feature. No pre-5B final Action is backfilled or assigned a guessed execution time.

## Trigger, atomicity and security

- An AFTER UPDATE OF status trigger records only actual `scheduled → completed/skipped` changes,
  explicitly checking `OLD.status IS DISTINCT FROM NEW.status`.
- Complete: Action update → Log trigger → Task update, in the existing RPC transaction. Any Log
  insert or Task update failure rolls all changes back. Skip changes only Action + Log.
- Null Task is supported. No-op/rejected transitions and unrelated Task/Goal/Plan operations do not
  create execution Logs. There is no separate mobile INSERT and no optimistic history append.
- The 5A RPC stays SECURITY INVOKER. Only the trigger is SECURITY DEFINER because clients must not
  receive Log INSERT permission. Its owner is a dedicated NOLOGIN/NOSUPERUSER/NOBYPASSRLS role,
  with Plan identity/date/timezone SELECT and Log INSERT only, not general table write privileges.
  CREATE on public is granted only for the ownership transfer and immediately revoked.
- Function search_path is empty, relations are schema-qualified, and direct execute is revoked
  from public/anon/authenticated/service_role. No dynamic SQL or client Log payload is accepted.
- The function derives owner/date/timezone from the stored Plan, checks `auth.uid()`, snapshots the
  existing Action, and rejects simultaneous execution-context rewrites.
- Log RLS allows authenticated users to SELECT only their own rows. Client INSERT/UPDATE/DELETE
  grants and policies are absent; anon has no access. The writer has a narrowly scoped INSERT
  policy and an owner-scoped Plan SELECT policy. Clients are not members of the writer role.
- Existing direct Action table grants remain unchanged. An owner updating an Action directly can
  still cause a real status transition and therefore a Log; 5B is not an audit trail protecting
  against arbitrary owner/admin edits to all source tables. Direct Log forgery, arbitrary event
  timestamps/owners and direct trigger-function invocation are not exposed.

## Read architecture and Today

The new `features/activity` public API exposes `ActivityLogRepository.listForPlanDate(LocalDate)`,
its domain snapshots, an independent read hook and a read-only section. The Supabase adapter scopes
by authenticated user + `plan_date`, validates DB rows and orders by `occurred_at DESC, id DESC`.
It preserves Postgres microsecond ordering instead of re-sorting truncated JS timestamps.

Today composes this repository separately from `TodayRepository`. A successful Today read advances
`dataRevision`, refreshing history after Complete/Skip, focus refresh or retry, even when the local
date is unchanged. History-only retry does not re-execute an Action or re-read the entire Plan.
History errors do not hide the saved Plan or deadline Tasks and do not turn a successful Execution
into a write failure. Old pending history reads are discarded after scope changes/unmount.

The query date is Today's profile-timezone local date, matched to the stored `plan_date`, not an
occurred-at/device-day range. A late execution remains attached to its original Plan day. Each
event's actual time is displayed in its snapshot timezone, not the current profile/device timezone.
UI shows the execution time, snapshot title and Complete/Skip badge newest first, with loading,
empty and isolated error/retry states. There are no UUIDs, edit/delete/manual-add or Undo controls.

## Local verification / type generation

The optional test harness from 5A accepts `--milestone=5b`. External temporary tools are
`@electric-sql/pglite@0.5.8` and `@supabase/postgres-meta@0.95.2`, not app dependencies.

```powershell
node scripts/verify-planned-action-execution-local.mjs <tools-directory> --milestone=5b --generate-types
```

It applies all migrations unchanged to isolated in-memory Postgres with a minimal auth/role
bootstrap, runs the 5A and 5B transactional SQL verifications, confirms rollback, and uses Supabase's
official catalog introspection and generator for `database.types.ts` (never hand-edited).
This does not replace real Supabase Auth gateway or concurrent-connection/remote verification.

SQL checks cover snapshots, event types/counts, null Task, correct owner/date/timezone/instant,
no backfill/no-op/rejected transitions, Task failure and Complete/Skip Log-insert failure rollback,
source-deletion and Plan-replacement durability, late execution, direct DML/function denial,
cross-user/anon/missing-identity isolation and restricted definer role privileges.

## Changed / added files

- `supabase/migrations/20261009090000_add_activity_logs.sql`
- `supabase/tests/remote/milestone_5b_verification.sql`
- `supabase/tests/remote/milestone_5b_readonly_diagnostics.sql` (added during remote investigation)
- `scripts/verify-planned-action-execution-local.mjs`
- `src/services/supabase/database.types.ts` (generated)
- `src/services/supabase/repositories/SupabaseActivityLogRepository.ts`
- `src/features/activity/repositories/ActivityLogRepository.ts`
- `src/features/activity/useActivityLogs.ts`
- `src/features/activity/components/ActivityLogSection.tsx`
- `src/features/activity/index.ts`
- `src/features/today/useToday.ts`
- `src/features/today/TodayScreen.tsx`
- `src/app/(tabs)/today.tsx`
- `src/__tests__/activity-log-repository.test.ts`
- `src/__tests__/activity-log-screen.test.tsx`
- `src/__tests__/today-route.test.tsx`
- `package.json` (adds the gated remote verification command only)
- `docs/milestone-5b-verification.md`

## Remote gate and remaining work before 5C

Do not run the new `supabase:verify:linked:5b` command until the migration has been approved and
applied. First review a linked migration dry-run: only `20261009090000_add_activity_logs.sql` should
be pending. After explicit approval, apply it, regenerate official linked DB types and run remote
verification (all SQL fixtures/temporary failure triggers roll back). Safely authenticated device
verification is a subsequent step; never guess credentials or call OpenAI for it.

Undo, Replanning, PlannerInput history/existingActions, Provider/Validator/Preview/stale-guard
changes and Activity Log aggregation/statistics are outside 5B. No app dependency, native,
OpenAI integration or Edge Function change is needed. No OpenAI API request or commit is authorized.

## Local handoff — 2026-11-04

- Local 5A and 5B SQL verification passed after applying all migrations to isolated PGlite.
  Fixtures and Activity Logs rolled back successfully. No remote SQL verification was executed.
- `database.types.ts` was regenerated with the official Supabase postgres-meta 0.95.2 generator
  against that migrated local catalog. Its new table definitions are not yet remote-schema types.
- Focused Today/Activity/route tests passed: 4 suites / 46 tests. Full Jest regression passed:
  50 suites / 452 tests (28 added tests), including 5A execution, deadline Tasks, Planner candidate
  selection, atomic persistence, RuleBased/OpenAI mocked generation and stale-preview validation.
- Typecheck, lint, format:check and git diff --check passed. A sandbox Jest cache permission failure
  was resolved by rerunning in the normal approved process environment; no test assertion failed.
- Linked dry-run returned exactly `20261009090000_add_activity_logs.sql` as the sole pending
  migration (`dryRun: true`). No migration was applied. Review/approval is required before remote
  application and remote-generated types/verification.
- No existing migration, 5A RPC, requirements file, Planner implementation, Edge Function,
  OpenAI integration, package dependency/lockfile, native configuration or app.json was changed.
  No OpenAI API request or Git commit was made; 5C has not been started.

## Remote attempt — 2026-11-04 (incomplete)

1. Fresh preflight dry-run listed only `20261009090000_add_activity_logs.sql`. After explicit user
   approval, that single migration was applied successfully without editing existing migrations.
2. Post-apply dry-run returned `upToDate: true`, `migrations: []`.
3. `npm run supabase:types:linked` replaced the local-generated types with official remote types.
   Activity Log Row/Insert/Update and the existing Execution RPC Args/Returns match the expected
   shapes; the generated PostgREST version is now 14.17. No mobile implementation repair was needed.
4. `npm run supabase:verify:linked:5b` failed at the first scheduled Complete with SQLSTATE 42501,
   `permission denied for schema auth`, while parsing the trigger's `auth.uid()` lookup. The
   Complete/Skip/null-Task, no-op/final-transition, failure-injection, durability and Today read
   cases therefore have NOT passed remote verification. The verification SQL now includes a
   fail-fast auth-schema privilege assertion and the explicit Today SELECT/order coverage loop.
5. Read-only catalog diagnostics confirmed: auth schema owner is `supabase_admin`; `postgres` has
   USAGE but lacks USAGE WITH GRANT OPTION; the writer has auth.uid EXECUTE but no auth schema
   USAGE. Its Log INSERT and Plan-owner column SELECT grants are present. This explains why the
   attempted GRANT in the migration did not establish effective namespace access remotely.
6. The logger owner is the expected restricted NOLOGIN/NOSUPERUSER/NOBYPASSRLS writer role, the
   function is SECURITY DEFINER and search_path is empty. Original catalog checks passed Log
   direct-DML/function-execute restrictions, but the later client DML execution assertions were
   not reached. The local auth bootstrap did not model the managed-schema grant restriction.
7. A separate read-only diagnostic query confirmed zero fixture users, profiles, Tasks, Plans,
   Actions and Logs, and absence of both temporary failure functions/triggers. The failed
   verification transaction rolled back; no existing user data was modified. The production 5B
   table/role/function/trigger remain installed. No temporary verification role was created.
8. Android manual verification was not attempted because the prerequisite remote Execution check
   is failing. No credentials, UI mutations, OpenAI requests, commits or 5C work were performed.

Additional changes during this attempt are generated `database.types.ts`, expanded verification
SQL, read-only diagnostics SQL and this record. No dependency/native/Planner/Edge Function change.
Post-remote typecheck, lint, format:check, test:ci and git diff --check all passed; Jest reported
50 suites / 452 tests. These mocked application checks do not override the failed remote Execution
verification or establish that production Execution is healthy.

An additional approved forward repair is required; applied migrations must not be rewritten.
Do not grant broad authenticated membership to the writer or silently change the logger to a
superuser owner. Repair design must preserve restricted ownership, `auth.uid()` scope, direct-Log
DML denial and atomicity, and must add a regression for the managed auth-schema grant restriction.
After repair approval/application, regenerate remote types, rerun all remote cases/cleanup checks
and conditional authenticated device verification before declaring 5B complete or starting 5C.

## Remote completion after approved fix — 2026-11-04

The approved fix alone was deployed; before/after dry-runs showed exactly that one pending
migration then zero. Remote-generated types were regenerated without manual edits and stayed
byte-identical. Dedicated permission, 5A, 5B and 4D verification all passed, including direct
status/reason UPDATE denial, snapshots, no-op/rejected transitions, Task/Log failure rollback,
source-deletion and Plan-replacement durability, ownership/anon/direct Log DML and Today query.
All fixture groups (users/Profiles/Tasks/Plans/Actions/Logs) are zero and temporary verification
functions/triggers are absent. No existing user data was modified. Full checks passed: 50 Jest
suites / 452 tests, typecheck, lint, format:check and git diff --check.

No running Android Emulator window was found by computer-use inventory; authentication could
not be confirmed, so manual verification remains explicitly unperformed. No credentials, OpenAI
requests, dependency/native changes, commits or 5C work. Implementation and remote DB verification
can be treated as 5B complete, with the optional safe-device check recorded as outstanding.
