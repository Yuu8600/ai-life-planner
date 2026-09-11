# AI Life Planner: agent guide

## Project scope

This repository contains the Japanese-first AI Life Planner mobile app described in
`docs/requirements/requirements-v0.1.md`. The product will eventually combine goals, tasks,
device calendar events, and AI-generated daily plans. Implement only the milestone requested by
the user; do not bring later-milestone behavior forward.

Milestone 1 is a static prototype with five bottom tabs, a separate Settings route, and local
dummy data. Supabase access, device-calendar permissions, OpenAI calls, CRUD behavior,
persistence, and planning logic are intentionally absent.

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

## Architecture boundaries

- Keep route files in `src/app` thin. They should compose feature screens and navigation only.
- Put feature-owned code in `src/features/<feature>`. Goals, tasks, calendar, and planner must
  remain independently evolvable.
- Keep Milestone 1 fixtures in each feature's `data.ts`; do not hide external I/O behind dummy
  services or make static controls imply that data is persisted.
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

- Do not add or call Supabase, `expo-calendar`, or OpenAI until the corresponding milestone.
- Values prefixed with `EXPO_PUBLIC_` are bundled into the client and are not secrets.
- Never expose `OPENAI_API_KEY`, a Supabase service-role key, or other server credentials to the
  mobile bundle. OpenAI requests must eventually cross a trusted server/Edge Function boundary.
- Keep real `.env` files untracked and update `.env.example` with placeholders only.

## Dependency discipline

- Use `npx expo install` for Expo/native packages so their versions match the installed SDK.
- Add only packages required by the current milestone.
- Preserve the package lock. Review Expo SDK compatibility before changing the peer-version
  overrides documented in `package.json`.
