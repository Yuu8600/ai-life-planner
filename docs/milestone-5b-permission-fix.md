# Milestone 5B permission repair — remote verified

> Current status (2026-11-04): the explicitly approved fix is applied and remote verification
> has passed. The previous auth namespace 42501 is resolved. All fixture groups are empty and
> temporary verification functions/triggers are absent. Android manual verification is not done
> because no running Emulator window/authenticated session could be confirmed. No commit or 5C work.

## Failure and pre-implementation investigation

Before repair, the applied 5B logger ran as `ai_life_planner_activity_writer`. Remote catalog reads confirmed
`auth` is owned by `supabase_admin`, migration `postgres` has USAGE but not its grant option,
and the logger had auth.uid EXECUTE but no auth namespace USAGE. The old trigger consequently
failed while resolving `auth.uid()`. Remote Postgres is 17.6; auth.uid EXECUTE is granted to PUBLIC.

Before implementation, the remote Action grants/policies were read and the findings reported:

- authenticated has table SELECT/INSERT/UPDATE/DELETE and status UPDATE; anon has no UPDATE.
- The four Action RLS policies only check `auth.uid() = user_id`. Thus an owner can directly PATCH
  status through Supabase/PostgREST and bypass Task completion/transition checks in the Execution RPC.
- App Action writes are limited to the 5A Execution adapter's RPC and 4D persistence RPC's
  DELETE/INSERT replacement. Today only SELECTs. No other Action UPDATE path was found in app code.
- UPDATE(reason) was initially retained only for SELECT FOR UPDATE in the public INVOKER wrapper.
  It also permits real client reason writes: a local authenticated UPDATE RETURNING test proves
  the reason changes under that old column grant. No live user row or remote client mutation was used.
- Once ALL locking/authoritative status decisions move to the existing private capability, the
  public wrapper needs no UPDATE privilege. The final design removes even UPDATE(reason).

## One forward migration

`20261104090000_fix_activity_log_trigger_permissions.sql` only. No applied migration is edited.
After separate explicit approval, this fix alone was applied remotely. Earlier local-only handoff
records below describe the pre-approval stage, not the current deployed status.

### Snapshot trigger

- The Activity Log trigger remains SECURITY DEFINER with its existing dedicated restricted NOLOGIN
  owner, empty search_path, qualified relation names and revoked client EXECUTE.
- Its body performs no authentication or JWT parsing. Owner/date/timezone come from the stored
  Action's Plan relation, checked against the Action owner through existing composite ownership FKs.
- Both logger-specific RLS policies also stop using auth.uid. The logger can read only the already
  granted Plan identity/date/timezone columns; its INSERT policy requires a matching stored
  owner/date/timezone Plan relation. Clients cannot assume the logger role or insert Logs directly.
- Existing transition filters, context rewrite rejection, snapshots, no-op/no-backfill semantics
  and transactional behavior are unchanged. There is no auth schema GRANT in the fix.

### Authenticated Execution boundary and direct-write restriction

- The public `update_planned_action_status(uuid,text)` remains SECURITY INVOKER with auth.uid,
  argument/authentication validation and a non-locking owned Action/Plan lookup. Signature/return
  type are unchanged. It never decides status/no-op from that unlocked read: it delegates every
  potentially valid request to the private capability, which rechecks after acquiring locks.
- authenticated has NO planned_actions UPDATE privilege, either table-wide or on any column,
  including reason. SELECT FOR UPDATE is no longer attempted by the public wrapper. The owner's
  existing UPDATE RLS alone does not grant UPDATE when table/column ACLs deny it.
- SELECT/INSERT/DELETE remain for Today and `replace_daily_plan()`. INSERT RLS additionally
  requires `status = scheduled`, closing terminal-INSERT and upsert bypasses without changing
  Planner persistence semantics. No existing Action/Task/Log row is rewritten by the migration.
- The write capability is `planner_execution_private.apply_transition()`, SECURITY DEFINER owned
  by a separate NOLOGIN/NOBYPASSRLS execution role. It has Action/Task status UPDATE and necessary
  SELECT columns only, plus Plan summary UPDATE solely for the Plan row lock. It cannot mutate
  arbitrary Action context or directly write Logs. Its RLS is request-owner scoped.
- The private capability independently checks identity, ownership, row locks, allowed transitions
  and no-op, and performs the WHOLE Action + Task operation in the same transaction as the Log
  trigger. Even a direct SQL caller with EXECUTE cannot obtain an Action-only update escape hatch.
  No caller-supplied user id or forgeable execution GUC/flag is accepted.
- This schema is not added to Data API exposed schemas (`public`, `graphql_public`). Authenticated
  receives schema USAGE + capability EXECUTE so the INVOKER RPC can call it; anon receives neither.
  Trusted service/admin direct table privileges are not being redesigned in this milestone.

### Narrow identity adapter, not an auth-schema grant

The separate Execution role needs the request identity for its own checks/RLS; the logger does not.
`planner_execution_private.actor_id()` is a zero-argument SQL-standard-body **SECURITY INVOKER**
function with empty search_path. The migration role binds its single `RETURN auth.uid()` expression
to the existing function OID at CREATE time, using that role's existing namespace access. Runtime
EXECUTE still applies: the Execution role uses the verified existing PUBLIC auth.uid EXECUTE grant,
but receives no auth namespace USAGE. Only that role may execute the adapter, not clients. There
is no SECURITY DEFINER identity bridge, manual JWT parser, arbitrary SQL or client user-id parameter.
Postgres 17 supports the parsed `prosqlbody`; local tests verify this representation and the real
request identity while direct `auth.uid()` resolution by the same role is denied.

## Local verification and type check

```powershell
node scripts/verify-planned-action-execution-local.mjs <tools-directory> --milestone=5b --permission-fix --check-types
```

The existing optional external PGlite 0.5.8 / official Supabase postgres-meta 0.95.2 tools are used,
not app dependencies. The harness gives auth a separate bootstrap owner and explicitly revokes
logger auth USAGE after the old 5B migration, reproducing the observed effective remote role state.
It first proves the old Complete fails with 42501 and leaves no partial state, then applies the fix
and verifies Execution with BOTH writers lacking auth USAGE.

This does not fully reproduce Supabase's managed grant control plane: the local bootstrap admin
is still a superuser, unlike managed postgres with no auth grant option. The repair never issues
such a GRANT. Real remote role behavior still requires verification AFTER approval/application.

SQL suites cover:

- Original auth namespace failure and rollback before the fix.
- 4D atomic plan persistence/replacement regression and rollback.
- 5A Complete/Skip, Task completion/unchanged status, null Task, no-op, rejected transitions,
  owner/other-user/anon and Task-failure rollback.
- 5B snapshots/history, direct Log DML/execute denial, source deletion/replacement durability,
  Task-update failure and Complete/Skip Log-insert failure rolling back Action/Task/Log.
- Permission fix: direct status/reason UPDATE, terminal INSERT and status upsert denied; private
  capability denies wrong owner/anon/missing identity and itself
  completes Task + Log atomically; private identity adapter is denied to clients.
- Non-login/non-bypass function ownership, RLS, safe search_path, no auth dependency in the logger
  body/policies, and owner-scoped locked Execution without auth namespace USAGE.

The official generator runs against the migrated local catalog, using the current generated
PostgREST marker. A normalized TypeScript AST comparison confirms public table/function types have
not changed. The existing official remote-generated `database.types.ts` is preserved, not edited
or replaced with local types. Formal remote regeneration belongs to the approved remote phase.

## Files in this repair

- New `supabase/migrations/20261104090000_fix_activity_log_trigger_permissions.sql`
- New `supabase/tests/local/activity_log_auth_namespace_regression.sql`
- New `supabase/tests/local/activity_log_reason_write_surface.sql` (old grant reproduction, rollback)
- New `scripts/verify-planned-action-concurrency-local.mjs` (independent real Postgres connections)
- New `supabase/tests/remote/milestone_5b_permission_fix_verification.sql`
- Updated `supabase/tests/remote/milestone_5b_verification.sql` for the new direct-status restriction
  and logger's lack of auth dependency
- Updated `scripts/verify-planned-action-execution-local.mjs` for reproduction, 4D regression and
  official generator comparison without overwriting remote types
- This record and the 5B verification record

No mobile, Today, Activity repository, Planner, Edge Function, OpenAI integration, dependency,
lockfile, native or app.json change is required. No OpenAI API request, commit or 5C work.

## Remote gate

The pre-apply gate required exactly the fix above, separate approval and no older migration edits.
That gate has now been satisfied; see the remote completion record below. Do not reapply it or
perform additional remote changes without authority. The historical local results alone were not
treated as production repair: actual remote Execution and permission suites have now passed.

## Local handoff — 2026-11-04

Historical pre-approval record:

- The negative regression reproduced the original auth namespace 42501 before the fix, with
  Action/Task/Log partial state rolled back. The old reason-grant write surface was also reproduced
  and rolled back. After the fix, SQL suites passed: 4D persistence, 5A Execution, dedicated
  permission-fix security and 5B history.
  All fixtures rolled back.
- Official Supabase generator check passed with unchanged public types. The authoritative
  remote-generated Database file was preserved byte-for-byte by this check.
- Application checks all passed: typecheck, lint, format:check, test:ci and git diff --check.
  Jest: 50 suites / 452 tests. New permission behavior is verified by real local SQL, not by
  mocked mobile tests.
- Linked dry-run returned `dryRun: true` and exactly one pending migration:
  `20261104090000_fix_activity_log_trigger_permissions.sql`. There were no other migrations,
  seeds or roles listed as separate push targets. No fix was applied remotely.
- Remote activity-logger permission failure remains unresolved in production pending approval.
  Read-only remote catalog checks reconfirmed auth grant limitations, current direct status UPDATE
  grants, Postgres 17.6 and PUBLIC auth.uid EXECUTE. No remote fixture/DML verification was run.
- No dependency/native/Planner/Edge Function/OpenAI integration changes. No OpenAI API request,
  Git commit or 5C work.

## Row-lock refinement: no authenticated UPDATE, concurrent verification

The authoritative lock order is solely inside `planner_execution_private.apply_transition()`:
Plan FOR UPDATE → Action FOR UPDATE → optional Task FOR UPDATE → atomic writes. After waiting,
the Action is read under lock before any no-op/final-transition decision. The public non-locking
ownership lookup can only cause an early rejection; it cannot authorize a stale success. Missing
or replaced Actions are rechecked by the helper and rejected. This retains the same Plan lock
coordination with `replace_daily_plan()` without leaving a client reason-write surface.

PGlite alone cannot prove concurrent transactions. A disposable localhost-only official Postgres
17.6 container was therefore used with separate TCP backend sessions at READ COMMITTED. The test
polls `pg_blocking_pids()` to prove the second call actually waits before releasing the first
transaction; it does not infer concurrency from two sequential calls or timing alone.

All eight cases passed:

1. Complete + Complete: second returns no-op, one Log.
2. Complete + Skip: second rejects after waiting, completed Task, one Log.
3. Skip + Complete: second rejects, Task stays pending, one Log.
4. Complete rollback + Skip: second observes scheduled state and succeeds, no partial Complete.
5. Two different Actions in the same Plan: both complete with consistent lock order.
6. Plan replacement first + Execution: deleted Action rejected after lock wait, no new Log.
7. Execution first + replacement: Task/Log retained although old Action is deleted.
8. Replacement + replay of a previously completed Action: rejects missing Action instead of
   returning an unlocked stale no-op.

The real Postgres run also passed reason-grant reproduction, permission, 5A, 5B and 4D SQL suites.
Multi-session fixtures had to be committed inside the disposable local DB so other sessions could
see them; they were explicitly cleaned up afterwards. Normal SQL suite fixtures use rollback.
This is not a Supabase Auth gateway/control-plane or all-isolation-levels proof. Under stricter
isolation, serialization errors may require retry; the intended endpoint default tested here is
READ COMMITTED, with atomic rollback/no partial history preserved.

Reproduce only against a fresh disposable local instance (the script refuses an existing auth /
profiles schema and connects only to 127.0.0.1):

```powershell
node scripts/verify-planned-action-concurrency-local.mjs <external-tools-directory> <disposable-local-postgres-port>
```

The external tools directory supplies pg (already included with the official generator tools),
not a new app dependency. Start a uniquely named/labelled `postgres:17.6` container with `--rm`, no
host data mounts, and a random port published ONLY on 127.0.0.1. Stop only that verified task
container after testing. Do not point this harness at a linked, forwarded or existing user DB.

### Final no-UPDATE handoff

Historical pre-approval record:

- The final migration has no authenticated planned_actions UPDATE grant at table or column level.
  Both catalog effective-privilege checks and owner status/reason UPDATE execution tests deny it.
- Permission/5A/5B/4D regression passed in PGlite and real Postgres 17.6. Old auth failure and old
  reason-write surface reproduction also passed as expected negative/rollback tests. Official
  generator comparison passed; remote-generated public types remain unchanged.
- All 8 independently blocked multi-connection cases passed twice on fresh disposable instances.
  Committed test fixtures were cleaned up, and both task-labelled containers/temporary DB volumes
  were stopped and auto-removed. The downloaded Postgres image remains only as a Docker cache.
- Final typecheck, lint, format:check and git diff --check passed. Jest: 50 suites / 452 tests.
- Final linked dry-run listed only `20261104090000_fix_activity_log_trigger_permissions.sql`,
  `dryRun: true`; no remote application, remote fixtures, commit or 5C work was performed.
- The deployed 5B auth-permission failure is still present until this reviewed fix is approved
  and applied. No existing migration, app dependency/native setting or OpenAI integration changed.

## Approved remote completion — 2026-11-04

### Deployment and authoritative types

- Immediate pre-apply dry-run listed only `20261104090000_fix_activity_log_trigger_permissions.sql`.
  That exact fix was applied successfully. Post-apply dry-run returned `upToDate: true`, no pending
  migrations. The original applied 5B migration's SHA256 stayed unchanged; it was not reapplied.
- `npm run supabase:types:linked` regenerated authoritative remote types through the official CLI.
  The file's SHA256 before/after generation is identical. Public Activity Log types and Execution
  RPC Args/Returns are unchanged; no mobile implementation or substitute types were needed.

### Effective permissions and function definitions

- authenticated Action SELECT/INSERT/DELETE are true; table UPDATE, any-column UPDATE, status UPDATE
  and reason UPDATE are false, with effective UPDATE column list `[]`.
- Actual authenticated fixture UPDATE attempts for status, reason and upsert were denied. Terminal
  INSERT was denied while valid scheduled persistence/replacement remained functional.
- Public RPC is INVOKER, retains auth.uid/authentication/arguments/non-locking ownership checks,
  and delegates without row locks. Private restricted-role DEFINER helper contains Plan → Action
  → Task locks and re-reads status after Action lock; its ownership/no-op/transition/write behavior
  passed the real remote tests. No dangerous remote parallel stress run was performed.
- Logger remains its expected restricted NOLOGIN role's DEFINER with empty search_path and no
  client EXECUTE. Its body and writer policies contain no auth schema dependency and derive owner
  from the Plan relation. BOTH writers still have auth namespace USAGE=false. Thus the old 42501
  was repaired without granting access to the managed auth schema.

### Remote SQL results

All four verification commands passed: dedicated permission-fix SQL, 5A Execution, 5B Activity Log,
and 4D atomic persistence. All suites used isolated fixture IDs and ROLLBACK.

| Case                                               | Result                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Complete                                           | Action + linked Task completed, one completed event                                               |
| Snapshot fields                                    | Correct owner/type/instant/Action reference/Task/date/timezone/title/scheduled instants           |
| Skip                                               | Action skipped, Task pending unchanged, one skipped event                                         |
| Null Task                                          | Complete and Skip succeed, null Task snapshot, no Task update                                     |
| Same final-status replay                           | No new event; existing event retained                                                             |
| Four forbidden final transitions/Undo              | Rejected, no new event                                                                            |
| Task-update failure                                | Action/Task/Log all rollback                                                                      |
| Complete/Skip Log-insert failure                   | Execution state and Log rollback                                                                  |
| Ownership/auth                                     | Owner succeeds; other owner, anon and missing identity rejected                                   |
| Log reads                                          | Own rows visible; other-owner/anon/missing-identity reads denied/empty as appropriate             |
| Direct Log INSERT/UPDATE/DELETE and logger execute | Denied                                                                                            |
| Action deletion, Plan replacement/deletion         | Logs and snapshots retained                                                                       |
| Linked Task deletion/profile timezone change       | Immutable reference/title/timezone snapshots retained                                             |
| Today repository query shape                       | Correct Plan date/user scope; DESC occurred_at/id; both event types and null Task retrieved       |
| 4D persistence                                     | Initial save, same-date replacement, multiple/zero Actions, null Task, atomicity/ownership passed |

A post-verification read-only catalog/cleanup report confirmed 0 fixture users, Profiles, Tasks,
Plans, Actions and Logs across ALL 4D/5A/5B/fix fixture owner IDs. Temporary m5a/m5b failure functions
and triggers are absent. Verification created no temporary roles; production roles/objects remain.
Existing user data was not modified for verification.

### Application checks, manual verification and handoff

- Final typecheck/lint/format:check/test:ci/git diff --check passed. Jest: 50 suites / 452 tests.
- computer-use app/window inventory found no running Android Emulator window. No authenticated
  session could be confirmed, so Android Complete/Skip/history manual verification was NOT
  performed. No credentials were guessed/entered and no existing user Action/Task was clicked.
- Additional files in this remote phase: read-only `milestone_5b_fix_readonly_diagnostics.sql` and
  updated verification records. Database types were formally regenerated with identical contents.
  No SQL migration repair, application code repair, dependency/native/Planner/OpenAI/Edge Function
  changes were needed after deployment.
- No OpenAI API call, Git commit, Undo or 5C work. Implementation + remote verification are complete;
  conditional safe authenticated Android verification remains explicitly unperformed, not passed.
