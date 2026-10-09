# Milestone 5A — Execution verification

## Semantics and boundaries

- `TodayRepository` remains read-only. `PlannedActionExecutionRepository.transition()` is the
  dedicated atomic write boundary; UI never updates Supabase tables directly.
- `scheduled → completed` also completes the owned linked Task, in one RPC transaction.
  MVP Actions represent whole Tasks (no splitting). A null `task_id` updates only the Action.
- `scheduled → skipped` changes only the Action. The Task's existing status is untouched; a
  pending Task remains eligible for the unchanged Planner candidate selector.
- Only these two transitions are accepted. Repeating the same final status is a no-op, including
  no Task re-write; changing or undoing a final status is rejected.
- The RPC uses `auth.uid()`, SECURITY INVOKER, empty search_path, explicit ownership conditions,
  existing RLS/composite ownership FKs, and plan → action → task locks. The plan lock coordinates
  with `replace_daily_plan()`; a removed/replaced Action id fails rather than targeting a new one.
- Existing table grants/RLS are not tightened. Transition restrictions apply to this RPC and
  Execution UI, not to every possible direct SQL update by an owner/admin.
- Today re-reads its DB projection after success (no optimistic status update). Deadline Tasks
  continue to include completed Tasks, displaying their latest status badge.
- Undo, Activity Log, Replanning and protection of execution history across a later whole-plan
  replacement are not part of 5A.

## Local checks without Docker

The optional harness uses an in-memory PGlite Postgres. It bootstraps only minimal Supabase auth
roles/catalog, applies all repository migrations unchanged, and executes the same transactional
SQL verification intended for remote verification. It does not validate the real Auth gateway or
concurrent Postgres connections; those remain remote/full-stack checks.

Install test tools in a **new temporary directory outside this repo**, not in the app:

```powershell
$executionTools = Join-Path ([IO.Path]::GetTempPath()) ('planner-5a-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $executionTools
npm install --prefix $executionTools --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.5.8 @supabase/postgres-meta@0.95.2
node scripts/verify-planned-action-execution-local.mjs $executionTools
```

Add `--generate-types` to generate `database.types.ts` from the actual migrated local catalog via
Supabase's official postgres-meta introspection queries and TypeScript generator (PostgREST 14.5).
Generated types must not be edited manually. No optional test package is added to app dependencies.

## Remote gate (requires explicit approval)

1. Run `npm run supabase:db:push -- --dry-run`; confirm only
   `20261007090000_add_planned_action_execution.sql` is pending. Stop if any other migration appears.
2. After approval, apply that migration only.
3. Run `npm run supabase:types:linked` to regenerate types from the authoritative remote schema.
4. Run `npm run supabase:verify:linked:5a`. The SQL uses isolated fixture UUIDs/emails and rollback;
   collisions fail closed, and no existing user rows are changed. The temporary failure-injection
   trigger is also rolled back.
5. Re-run typecheck, lint, format:check, test:ci, and git diff --check.
6. With a safely available authenticated emulator session, verify Today Complete/Skip and refresh,
   linked Task status, and absence of Execution buttons for final Action statuses. Do not guess
   credentials or call OpenAI for this verification.

The migration was applied to the linked backend on 2026-10-09 after explicit approval. See the
remote verification record below; rerunning a migration push requires a fresh pending-set check.

## Changed / added files

- `src/app/(tabs)/today.tsx`
- `src/features/today/TodayScreen.tsx`
- `src/features/today/components/Timeline.tsx`
- `src/features/today/index.ts`
- `src/features/today/useToday.ts`
- `src/features/today/usePlannedActionExecution.ts`
- `src/features/today/plannedActionExecution.ts`
- `src/features/today/repositories/PlannedActionExecutionRepository.ts`
- `src/services/supabase/repositories/SupabasePlannedActionExecutionRepository.ts`
- `src/services/supabase/database.types.ts` (generated, never hand-edited)
- `src/__tests__/planned-action-execution.test.ts`
- `src/__tests__/planned-action-execution-repository.test.ts`
- `src/__tests__/today-screen.test.tsx`
- `src/__tests__/today-route.test.tsx`
- `src/__tests__/planner-task-selection.test.ts` (tests only, algorithm unchanged)
- `supabase/migrations/20261007090000_add_planned_action_execution.sql`
- `supabase/tests/remote/milestone_5a_verification.sql`
- `scripts/verify-planned-action-execution-local.mjs`
- `package.json` (verification command only, dependencies unchanged)
- `docs/milestone-5a-verification.md`

Local handoff (2026-10-07): 48 Jest suites / 424 tests passed. Typecheck, lint, format:check and git diff --check
passed. SQL verification passed on isolated PGlite and all fixtures rolled back. Linked dry-run
listed only `20261007090000_add_planned_action_execution.sql`; remote application/verification and
authenticated emulator execution were pending at that handoff. No commit or OpenAI call was made.

## Remote verification — 2026-10-09

- Preflight dry-run listed exactly `20261007090000_add_planned_action_execution.sql`.
- That migration alone was applied successfully. Post-apply dry-run returned `upToDate: true`
  and `migrations: []`.
- `npm run supabase:types:linked` regenerated `database.types.ts` from the linked remote schema,
  replacing the temporary local output without manual edits. The RPC has string Args
  `p_action_id` / `p_target_status` and array Returns containing string `action_id` / `action_status`.
  No implementation adjustment was needed.
- `npm run supabase:verify:linked:5a` passed all assertions: scheduled Complete, linked Task Complete,
  injected Task-write failure rolling back both rows, scheduled Skip leaving Task pending, null Task
  Complete/Skip, final-status no-op replays, forbidden final-status changes/Undo, other-owner rejection,
  unauthenticated rejection, SECURITY INVOKER, safe search_path, and execution grants.
- A separate read-only cleanup query confirmed zero fixture users, profiles, Tasks, Daily Plans and
  Planned Actions, and absence of the temporary failure-injection function/trigger. Existing user
  data was not modified for verification.
- Post-remote typecheck, lint, format:check, test:ci and git diff --check all passed: 48 suites /
  424 tests. No dependency/native/lockfile, Planner, Edge Function or OpenAI integration changes.
- Android manual verification was not performed: the computer-use runtime failed to start with
  `helper_unknown_error: setup refresh had errors`, including after a kernel reset/retry. Authenticated
  session availability could not be checked; no credentials were entered and no UI mutations made.
- Implementation and remote DB verification are complete. Conditional authenticated Android manual
  verification remains outstanding. No Git commit or OpenAI API call was made; 5B was not started.
