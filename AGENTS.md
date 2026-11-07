# AI Life Planner: agent guide

## Project scope

This repository contains the Japanese-first AI Life Planner mobile app described in
`docs/requirements/requirements-v0.1.md`. The product will eventually combine goals, tasks,
device calendar events, and AI-generated daily plans. Implement only the milestone requested by
the user; do not bring later-milestone behavior forward.

Core v1 Native is implemented and verified on iOS Simulator and iPhone. It includes Auth,
Goals/Tasks/Settings, device Calendar, free-time calculation, RuleBased and optional OpenAI
planning, Preview approval, persistence, Today execution, Activity Log, and guarded replanning.
Web Demo uses sample data and in-memory repositories, with no Auth, Supabase, OpenAI or device
Calendar access. Native and `.web.tsx` composition lives in `src/navigation`; `src/app` stays thin.
Shared Planner business rules remain common to both platforms. See `docs/web-demo.md` for the
static export, Project Pages base path, manual deployment workflow and verification limits.
Do not publish, push, create PRs or merge without the user's explicit instruction.

Treat the versioned requirements file as a project source of truth. Do not silently reformat or
rewrite it; requirement changes need explicit user authorization and should be versioned.

## Commands

- `npm install`: install the locked dependencies.
- `npm start`: start Expo.
- `npm run start:dev`: start Metro for an installed development build.
- `npm run android`: open the Android target.
- `npm run android:dev`: generate/build the Android development client and run it.
- `npm run ios`: open the iOS target (requires macOS for a local simulator).
- `npm run typecheck`: run TypeScript without emitting files.
- `npm run lint`: run the Expo ESLint configuration.
- `npm run format`: apply Prettier.
- `npm run format:check`: verify formatting without changing files.
- `npm test`: run Jest in local watch mode.
- `npm run test:ci`: run Jest once without watch mode.
- `npm run supabase:migration:new -- <name>`: create a timestamped migration.
- `npm run supabase:db:push`: apply migrations to the linked remote project.
- `npm run supabase:types:linked`: generate public schema types from the linked project.
- `npm run supabase:types:local`: generate public schema types from a running local stack.
- `npm run supabase:verify:linked`: transactionally verify schema, grants, RLS, and FK behavior on
  the linked remote project; all fixtures are rolled back.
- `npm run supabase:verify:linked:2b4`: after applying the Milestone 2B-4 migration,
  transactionally verify Daily Plan / Planned Action schema, grants, RLS, constraints, and FK
  behavior; all fixtures are rolled back.

## Architecture boundaries

- Keep route files in `src/app` thin. They should compose feature screens and navigation only.
- Put feature-owned code in `src/features/<feature>`. Goals, tasks, calendar, and planner must
  remain independently evolvable.
- Keep the remaining Milestone 1 fixtures in their feature `data.ts` files; do not hide external
  I/O behind dummy services or make static controls imply that data is persisted. Goals, Tasks,
  Today, Settings, and Calendar are exceptions because their requested integration milestones are
  implemented.
- Keep business rules in feature domain/application modules or pure functions, never directly in
  route files or presentational components.
- Put reusable, feature-neutral UI, configuration, and types in `src/shared`.
- Put external I/O adapters in `src/services`. Feature code should depend on an interface rather
  than importing vendor SDKs throughout the UI.
- Do not import another feature's internal files. Expose an intentional public API when features
  need to collaborate, or move genuinely shared contracts to `src/shared/types`.
- Use the `@/` alias for imports rooted at `src`.

## TypeScript and code quality

- Keep TypeScript strict mode enabled. Avoid `any`; validate data at system boundaries.
- Prefer small components, pure functions, and explicit domain types.
- Keep tests outside `src/app` so Expo Router never treats them as routes.
- Add focused tests for requested behavior without introducing redundant test libraries.

### Staged verification

- **A. During development:** prioritize related Jest tests and the lint / format checks needed for
  changed files. Run the full typecheck when types or interfaces change. Do not run all tests after
  every small edit.
- **B. At implementation completion:** run `npm run typecheck`, `npm run lint`, Prettier checks
  for changed files, related Jest tests, and `git diff --check`. Run **all Jest tests** when changes
  affect shared Planner logic / contracts / Validator; Calendar / free time / timezone;
  persistence / replanning / stale guards; shared UI or multiple screens; dependencies or
  configuration; or when the impact is unclear.
- **C. Before a PR or release:** verify all Jest tests, typecheck, lint, full format check
  (`npm run format:check`), and `git diff --check`. Add Web export / artifact verification and
  Expo Doctor / native builds / device checks according to the change. Keep existing CI quality
  gates intact. `npm run format` writes changes; it is not the format verification command.
- For documentation-only changes, check formatting of changed files, review the diff and document
  consistency, and run `git diff --check`. At stage C, the full checks above still apply. Do not run
  E2E, native builds, or exports solely for documentation changes.
- See `docs/development.md#品質チェック--ci` for commands and platform verification triggers.

### Reuse results and report concisely

- Reuse a successful check when its command, scope, and tested code state are known and still
  applicable; do not repeat it just because work moves to another stage. After related source,
  tests, configuration, or dependencies change, rerun affected checks. If the result or tested
  state is uncertain, perform the necessary verification. Never report an unrun check as passed.
- On success, report the command, pass / fail result, test counts where applicable, and elapsed
  time when useful. Do not paste long PASS lists or unnecessary build logs into the final report.
- On failure, retain and inspect the details needed to diagnose it. Surface warnings and failures,
  preserve and check exit codes, and do not treat a zero-test selection as successful verification.

## Integrations and secrets

- Keep Supabase access inside `src/services/supabase` and repository implementations. Do not call
  Supabase directly from routes or UI components.
- Keep auth state and operations behind the public `src/features/auth` boundary. Route guards and
  Settings must consume that boundary instead of creating another Supabase client.
- Keep Goals UI and state management dependent on `GoalRepository`; the Supabase adapter belongs
  under `src/services/supabase/repositories` and must receive the authenticated user id at the
  composition boundary.
- Keep Tasks UI and state management dependent on `TaskRepository`; load Goal association options
  through that feature contract without importing Goal feature internals.
- Keep Today UI and state management dependent on `TodayRepository`. Resolve its local-day bounds
  from `profiles.timezone`, query by `planned_actions.start_at`, and reject invalid timezones rather
  than silently falling back. Do not use `tasks.deadline` as an execution date.
- Keep Settings UI and state management dependent on `SettingsRepository`. Read and update only
  `timezone`, `planning_start`, `planning_end`, `minimum_free_minutes`,
  `calendar_buffer_before_minutes`, and `calendar_buffer_after_minutes`; scope every adapter
  operation to the authenticated profile id and validate inputs before writing.
- Keep Calendar UI and state management dependent on `CalendarRepository`; only the adapter under
  `src/services/calendar` may import `expo-calendar`. Keep integration read-only, retain all-day and
  availability metadata without assigning busy semantics, and never persist device events to
  Supabase. Use the profile timezone and the public Today date utilities for local-day bounds.
- Use the stable SDK 57 Calendar API (`getCalendarPermissions`, `requestCalendarPermissions`,
  `getCalendars`, and `listEvents`), not the deprecated legacy `*Async` methods. Calendar requires a
  development build; Expo Go is unsupported for this API version.
- Keep free-time calculation under the planner feature as pure TypeScript. Resolve planning clock
  times with the public Today timezone utilities, preserve Calendar all-day date semantics, and do
  not make the calculator depend on Expo, React, Supabase, or UI components.
- Keep OpenAI optional and server-mediated. Web Demo must not instantiate native SDKs, Supabase
  clients or remote Planner providers. Keep Demo I/O adapters under `src/services/demo`.
- Values prefixed with `EXPO_PUBLIC_` are bundled into the client and are not secrets.
- Never expose `OPENAI_API_KEY`, a Supabase service-role key, or other server credentials to the
  mobile bundle. OpenAI requests must eventually cross a trusted server/Edge Function boundary.
- Keep real `.env` files untracked and update `.env.example` with placeholders only.
- Treat `src/services/supabase/database.types.ts` as generated output. Regenerate it from a local
  or linked schema after migrations; do not hand-write substitute database types.

## Dependency discipline

- Use `npx expo install` for Expo/native packages so their versions match the installed SDK.
- Add only packages required by the current milestone.
- Preserve the package lock. Review Expo SDK compatibility before changing the peer-version
  overrides documented in `package.json`.
