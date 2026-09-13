# AI Life Planner: agent guide

## Project scope

This repository contains the Japanese-first AI Life Planner mobile app described in
`docs/requirements/requirements-v0.1.md`. The product will eventually combine goals, tasks,
device calendar events, and AI-generated daily plans. Implement only the milestone requested by
the user; do not bring later-milestone behavior forward.

Milestone 2B-2 connects only the Goals feature to Supabase through the existing GoalRepository
contract. Email + Password authentication, protected routes, and session restoration remain the
auth foundation. Tasks, Today, Calendar, and AI screens still use local dummy data. Task
persistence, email-confirmation deep links, device-calendar permissions, OpenAI calls, and
planning logic remain intentionally absent.

Treat the versioned requirements file as a project source of truth. Do not silently reformat or
rewrite it; requirement changes need explicit user authorization and should be versioned.

## Commands

- `npm install`: install the locked dependencies.
- `npm start`: start Expo.
- `npm run android`: open the Android target.
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

## Architecture boundaries

- Keep route files in `src/app` thin. They should compose feature screens and navigation only.
- Put feature-owned code in `src/features/<feature>`. Goals, tasks, calendar, and planner must
  remain independently evolvable.
- Keep the remaining Milestone 1 fixtures in their feature `data.ts` files; do not hide external
  I/O behind dummy services or make static controls imply that data is persisted.
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
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test:ci` before
  handing off changes.
- Add focused tests for requested behavior without introducing redundant test libraries.

## Integrations and secrets

- Keep Supabase access inside `src/services/supabase` and repository implementations. Do not call
  Supabase directly from routes or UI components.
- Keep auth state and operations behind the public `src/features/auth` boundary. Route guards and
  Settings must consume that boundary instead of creating another Supabase client.
- Keep Goals UI and state management dependent on `GoalRepository`; the Supabase adapter belongs
  under `src/services/supabase/repositories` and must receive the authenticated user id at the
  composition boundary.
- Do not connect Tasks, Today, Calendar, or AI dummy data to Supabase until their requested
  milestones.
- Do not add or call `expo-calendar` or OpenAI until the corresponding milestone.
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
