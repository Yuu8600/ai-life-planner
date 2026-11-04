# Milestone 5C-2 — Replanning, remote verified

Status (2026-11-05): the approved migration is applied to linked Supabase and remote verification
has passed. The original local implementation record is retained below; the approved remote
completion record at the end supersedes the earlier handoff status. No OpenAI request, Edge
Function deployment, Git commit, dependency/native change, or requirements rewrite. Android
manual verification was unavailable; no running authenticated Emulator was found.

## Flow and UX

Today shows 「再計画する」 only when a Daily Plan exists, including zero-Action Plans. Loading,
failed refresh, and pending Execution disable the entry. A fresh route entry token opens the
existing AI tab in application-only `replan` mode. The Preview screen is keyed by user, mode and
entry token: earlier Preview/validation/confirmation/save state is retired by unmount, including
repeat entries into the same mode. Entry never runs a Provider. Ordinary Today → AI entry selects
generate mode explicitly. Cancel and successful Replan clear route intent and return to Today.

The existing Provider-neutral pipeline loads latest Settings, Calendar, Goals and Tasks, runs
`calculateFreeTime`, `clipPlannerFreeSlots(now)`, and `buildPlannerInput`, then runs the explicitly
selected Provider and shared Validator. RuleBased remains the default. OpenAI is optional; tests
use a local stub only. A consistent owned Plan/Action snapshot is read after input loading and
before Provider execution. It stays on Preview application data, never on PlannerInput.

Only pending Tasks are candidates, subject to existing active-Goal, ranking and budget rules.
Completed/scheduled/skipped Task statuses stay excluded. A skipped Action's pending Task, past
scheduled Action's pending Task, future scheduled Action's pending Task, and a Task whose Action
appears to be in progress all use the same candidate rules and full estimatedMinutes. No remaining
duration is inferred. Old null-Task, completed and skipped Actions are not carried forward. Old
scheduled Actions are not automatically skipped. The selector, scheduler and Provider Contracts
are unchanged.

Entry, generation, Preview, Provider selection, regeneration and Cancel never persist anything.
Approval confirms full replacement, including in-progress-looking Actions, and retention of
completion/skip history. Zero-Action confirmation explicitly states that all old Actions will be
deleted. Summary becomes the new Proposal summary. Planner persistence does not change Tasks.
Activity Logs are neither rewritten nor inserted by replacement.

Success navigates to Today; existing focus refresh reloads the Plan and dataRevision reloads
history. The Today counter now says 「この計画の完了数」 because it counts current Plan Actions,
not cumulative Activity Logs. Existing read failures remain separate from mutation success.

## Two approval boundaries

1. Existing application stale guard reloads latest dependencies, calculates and clips freeSlots,
   and validates the SAME displayed Proposal. Invalid Preview stays visible with explicit
   regeneration. Provider execution is never repeated by approval or stale handling.
2. `replace_daily_plan_if_current` checks the captured token and proposed Task states inside
   the saving transaction, then invokes the unchanged `replace_daily_plan` in that transaction.

Snapshot fields are Plan id, planDate, timezone, summary, updatedAt and the complete Action array
ordered by UUID with each Action's id, status and updatedAt. Timestamps are canonical UTC strings
with PostgreSQL microsecond precision, preserved without JS Date normalization. Plan id or Plan
updatedAt alone is insufficient; Execution changes Action state without updating the Plan row.
Approval never refreshes the token to silently accept a changed Plan.

The private helper locks Plan → all current Actions in UUID order → proposed non-null Tasks in
UUID order. After lock waits it compares the complete token and rechecks Task ownership,
existence and pending status. Unrelated Tasks are not locked/checked. A final wall-clock check
rejects proposed starts already in the past, using clock_timestamp rather than transaction-start
now. Only after the guard succeeds does normal atomic replacement execute. A guard failure or
later insertion failure rolls back the operation, retaining the pre-save Plan/Actions/history.

Dedicated SQLSTATE `P5C01` maps to application stale, distinct from ordinary read/network/DB
failures. Preview is retained and approval blocked until explicit regeneration. No fallback write
or Provider retry is performed.

## Migration, security and generated types

Only new migration: `20261105090000_add_guarded_replanning.sql`. Previous migrations are unchanged.
No table/column changes. New public RPCs:

- `get_daily_plan_snapshot(date) → jsonb`, a single consistent owner-scoped read statement.
- `replace_daily_plan_if_current(date,text,text,jsonb,jsonb) → daily_plan_id/saved_action_count`.

Both public RPCs are SECURITY INVOKER with empty search_path and no anonymous/public EXECUTE.
The private lock helper is SECURITY DEFINER, empty search_path, owned by the existing restricted
NOLOGIN execution writer. Only read access to required Plan metadata and Action updated_at is
added to that role. Existing RLS, Action/Task lock privileges and the pre-bound identity adapter
are reused. No authenticated Action UPDATE grant or writer auth-schema USAGE grant is added.

As in 5B, INVOKER delegation requires authenticated/service_role EXECUTE on the private helper.
This is not a blanket SQL EXECUTE denial: the helper is in the non-exposed private schema, not
reachable as a Data API RPC. A direct SQL call still performs owner-scoped checks/locks only and
cannot update or replace anything itself. The public wrapper continues to the existing RLS-bound
replacement under the caller's privileges. No client-supplied owner/user id is accepted.

`database.types.ts` was regenerated from the migrated isolated local catalog using official
Supabase postgres-meta 0.95.2 introspection and TypeScript generator. No hand edits or RPC typing
escape hatches. Public table types and existing RPC signatures remain unchanged; only the two
new public RPCs appear (plus generator formatting). After approved remote application, regenerate
again from linked remote schema.

## Verification

Commands for optional tools installed outside the app dependency tree:

```powershell
node scripts/verify-planned-action-execution-local.mjs <external-tools-directory> --milestone=5b --permission-fix --milestone=5c --generate-types
node scripts/verify-planned-action-execution-local.mjs <external-tools-directory> --milestone=5b --permission-fix --milestone=5c --check-types
node scripts/verify-planned-action-concurrency-local.mjs <external-tools-directory> <fresh-local-postgres-port> --replanning
```

The local harness applies every versioned migration unchanged. PGlite SQL verification and a
fresh official PostgreSQL 17.6 container both passed 4D, 5A, 5B permission-fix, 5B and 5C suites.
5C SQL verifies unchanged-token success, Complete/Skip/other replacement rejection, Task final
statuses/deletion/other ownership rejection, missing Plan, past start, ownership/auth, nullable
Task, unrelated Task edits, zero Actions, no old Action carry, preserved completion/skip Logs,
Task status unchanged by saving, and rollback after a failure during replacement insertion.
Normal SQL fixtures end with ROLLBACK; all fixture users/plans/tasks/actions/logs are verified empty.

Separate READ COMMITTED PostgreSQL connections prove actual blocking using pg_blocking_pids.
All existing 8 Execution/replacement concurrency cases and these 9 Replanning cases passed:

1. Complete first → guarded Replan stale; completed Task/Log retained.
2. Skip first → guarded Replan stale; pending Task/Skip Log retained.
3. Normal replace first → guarded Replan stale.
4. Guarded Replan first → old Action Complete fails, no forged Log.
5. Direct Task completion first → Replan waits for Task lock, then rejects stale.
6. Replan first → later Task edit waits, then is accepted as a subsequent change.
7. Two guarded Replans with one token → second rejects stale.
8. Skip rollback → unchanged-token Replan succeeds, no Skip Log.
9. Replan first → old Action Skip fails, no forged Log.

Cross-session fixtures necessarily commit inside the fresh localhost-only disposable DB. They
are cleaned up and zero counts asserted. The labelled disposable container is stopped/removed
after verification. This is not remote concurrency stress or a Supabase gateway integration test.

Jest additions/updates cover Today entry with absent/empty/populated Plans, unique navigation
tokens, Preview remount on repeated entry, Today return, explicit generation, no-write Cancel and
regeneration, replacement confirmation including zero Actions, DB-stale Preview retention and
explicit regeneration, original-token guarded persistence, application validation before DB,
RuleBased/OpenAI-stub shared flow, full Task estimates, missing Plan, typed RPC payload/result
validation and exact conflict/error mapping. Existing stale/Calendar/selection/Today/history
tests continue to cover the shared implementation.

Final local checks all passed:

| Check                    | Result                  |
| ------------------------ | ----------------------- |
| npm run typecheck        | Passed                  |
| npm run lint             | Passed                  |
| npm run format:check     | Passed                  |
| npm run test:ci          | 51 suites / 476 tests   |
| git diff --check         | Passed                  |
| Official type comparison | Matches migrated schema |

Linked `npm run supabase:db:push -- --dry-run` succeeded with exactly
`20261105090000_add_guarded_replanning.sql` in migrations, empty seeds/roles and dryRun=true.
There were no unexpected pending migrations. It did not apply anything remotely.

## Changed files

Application and UI:

- src/app/(tabs)/today.tsx
- src/app/(tabs)/ai.tsx
- src/features/today/TodayScreen.tsx
- src/features/today/components/PlanSummary.tsx
- src/features/planner/PlannerPreviewScreen.tsx
- src/features/planner/usePlannerPreview.ts
- src/features/planner/plannerPreview.ts
- src/features/planner/plannerPersistence.ts
- src/features/planner/index.ts
- src/features/planner/repositories/PlannerReplanRepository.ts (new)
- src/services/supabase/repositories/SupabasePlannerReplanRepository.ts (new)
- src/services/supabase/database.types.ts (official local-generated output)

Tests and verification:

- src/**tests**/planner-replan-repository.test.ts (new)
- src/**tests**/planner-approval.test.ts
- src/**tests**/planner-preview-screen.test.tsx
- src/**tests**/planner-route.test.tsx
- src/**tests**/today-route.test.tsx
- src/**tests**/today-screen.test.tsx
- scripts/verify-planned-action-execution-local.mjs
- scripts/verify-planned-action-concurrency-local.mjs
- supabase/migrations/20261105090000_add_guarded_replanning.sql (new)
- supabase/tests/remote/milestone_5c_verification.sql (new; executed locally only)
- docs/milestone-5c-verification.md (new)

## Known Core v1 boundaries

- Calendar is external device data: approval validates the latest read; a change between that
  read and DB save cannot be locked by PostgreSQL. No distributed Calendar transaction is added.
- DB guarding checks the expected Plan/Action state and Tasks actually scheduled by the Proposal.
  It does not freeze unrelated Tasks, all Task metadata, Goals or Settings across the external
  input reads. Existing application validation still governs those inputs.
- A Task edit after the Replan transaction wins the lock and commits is a new later change.
- Normal generate/save retains existing unconditional replace semantics for compatibility. It
  can run before a guarded Replan (which then rejects); a later normal save is still a new replace.
- Existing final Actions leave the current Plan timeline after replacement; history remains in
  Activity Log. Pending Tasks are candidates, not guaranteed to fit the remaining freeSlots.
- Today's end can yield a valid zero-Action Proposal; replacement requires explicit confirmation.
- No automatic retry/regeneration, Undo, future-day UI, progress tracking or partial carry.
- Remote migration application, linked type regeneration and remote SQL verification were
  subsequently completed with explicit approval (record below). Android manual verification
  remains unperformed; no running authenticated Emulator was available.

## Approved remote completion — 2026-11-05

Pre-application dry-run listed ONLY `20261105090000_add_guarded_replanning.sql`. The approved
`npm run supabase:db:push -- --yes` applied that one migration. Post-application dry-run returned
upToDate=true and migrations=[], seeds=[], roles=[]. No old migration was edited/reapplied. The
migration SHA256 remained `7D8881E7C8B314BA9220D3F0814FF789BF19E146101A16A22ED2B0212099B286`.

`npm run supabase:types:linked` regenerated official remote public types. Both RPC Args/Returns
match the local-generated definitions; a second official local-generator AST comparison passed
without overwriting the remote output. Byte changes were generator formatting only. Formal
remote file SHA256: `8C1D40FD6321365199A295E1BAEAE2007BA003A7474E078A2BF1C7DEFBCAE682`.
No application implementation adjustment or typing workaround was required.

Remote catalog diagnostics confirmed:

- authenticated Action SELECT/INSERT/DELETE=true; table/any-column/status/reason UPDATE=false;
  permitted UPDATE columns=[]. The 5B permission suite also rejected actual reason/status DML.
- Both new public RPCs are INVOKER; guarded save explicitly authenticates auth.uid, snapshot
  reads use owner RLS/pre-bound identity, neither accepts a user-id argument.
- The private helper is DEF owned by the restricted NOLOGIN execution writer, search_path empty;
  writer auth-schema USAGE=false and private schema CREATE=false. Plan → Action → Task ordering,
  snapshot/status checks after locks and wall-clock check after lock waits are present remotely.
- Anonymous private helper EXECUTE=false. Authenticated SQL EXECUTE=true is the existing 5B-style
  INVOKER delegation, NOT a direct SQL execute denial. The helper is not a public RPC and performs
  only authenticated ownership-scoped guards/locks. An anonymous Data API probe with private
  Content-Profile was rejected with HTTP406/PGRST106: private schema is not exposed.

Remote verification results:

| Case                                   | Result                                                              |
| -------------------------------------- | ------------------------------------------------------------------- |
| Unchanged snapshot                     | Same Plan id, new summary/Actions, pending Task unchanged           |
| Complete after snapshot                | P5C01; completed Action/Task and Log retained                       |
| Skip after snapshot                    | P5C01; skipped Action/Log retained, Task unchanged                  |
| Another replace with same Plan id      | P5C01; winning replacement retained                                 |
| Proposal Task completed/scheduled/skip | P5C01; no new scheduled Action                                      |
| Task deleted or owned by another user  | Rejected                                                            |
| Unrelated Task changed                 | Valid replacement accepted                                          |
| Missing Plan / missing auth / owner    | Rejected / owner-scoped read only                                   |
| Past start                             | P5C01                                                               |
| Mid-insert failure after valid row     | Whole replace rolled back; original Plan/Actions/Tasks/Logs intact  |
| Old completed/skipped/free Actions     | Not copied; existing execution Logs retained                        |
| New null-Task / zero-Action Proposal   | Accepted; later stale empty Plan replacement rejected               |
| Today owner/date/action-bound reads    | New Plan/Actions and retained history readable with expected scope  |
| 4D regression                          | Initial save, same-day replace, null Task, atomicity/ownership pass |
| 5A / 5B / 5B permissions               | Complete/Skip, Task effects, Logs, no-op, rollback, security pass   |

The final `milestone_5c_verification.sql` strengthens assertions for new summary, all Task rows
on rollback, Today-scoped reads, and a valid first insert followed by an invalid second insert.
It and the existing 4D/5A/5B/permission suites were executed on linked DB. All ordinary fixtures
were inside ROLLBACK transactions, never existing user rows.

The explicitly approved limited remote concurrency harness used independent CLI-backed sessions,
READ COMMITTED behavior, transaction-local application_name and pg_blocking_pids proof of actual
waiting. Only one new synthetic owner was used; holds are bounded to 35 seconds. All five passed:

1. Complete first → waiting Replan rechecks snapshot and rejects P5C01; Complete/Task/Log retained.
2. Skip first → waiting Replan rejects P5C01; Skip/Log retained, pending Task preserved.
3. Normal replacement first → waiting Replan rejects P5C01; replacement winner retained.
4. Task completion first → Replan waits at Task lock, rechecks pending, rejects P5C01.
5. Unchanged Plan lock held until proposed start elapsed → wall-clock guard rejects P5C01.

All cases verified zero new Action insertion and unchanged winning summary. The cross-session
fixture necessarily committed for visibility; final cleanup deleted only the fixed synthetic
user matching this run's unique metadata marker. Cleanup asserted users/profiles/tasks/plans/
actions/logs all zero. Final read-only diagnostics reconfirmed zero fixtures across all named
4D/5A/5B/5C verification owners and no temporary verification functions/triggers. Existing user
data was not modified.

DB error P5C01 → repository conflict → application stale, retained Preview, explicit regeneration
and no Provider/normal-save fallback were reconfirmed in Jest. Today return/focus refresh/history
dataRevision were verified by UI tests and corresponding remote owner/date SQL reads, not by a
real authenticated mobile session. Computer Use app/window inventory found no running Emulator;
no login, credential guessing, personal Plan modification or OpenAI request was performed.

Final checks: typecheck, lint, format:check, test:ci (51 suites / 476 tests), git diff --check all
passed. The Calendar race limitation above remains documented. Core v1 Replanning implementation
and remote DB verification are complete; real Android manual verification remains a release
follow-up. No later milestone was started.

Additional files in the approved remote phase:

- src/services/supabase/database.types.ts — official remote regeneration, no semantic type change.
- supabase/tests/remote/milestone_5c_verification.sql — additional rollback/summary/Today assertions.
- supabase/tests/remote/milestone_5c_readonly_diagnostics.sql — new catalog/fixture report.
- scripts/verify-replanning-concurrency-linked.mjs — bounded approved remote fixture-only races.
- scripts/verify-replanning-api-boundary.mjs — private Data API schema exposure probe, no JWT.
- docs/milestone-5c-verification.md — this completion record.

Optional explicit verification commands (never auto-run the remote harness without approval):

```powershell
node scripts/verify-replanning-concurrency-linked.mjs --linked-approved
node scripts/verify-replanning-api-boundary.mjs
node node_modules/supabase/dist/supabase.js db query --linked --file supabase/tests/remote/milestone_5c_verification.sql
node node_modules/supabase/dist/supabase.js db query --linked --file supabase/tests/remote/milestone_5c_readonly_diagnostics.sql
```
