<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Torneiamo engineering contract

These rules apply to every coding agent working on tournament formats, scoring,
rankings, brackets, participants, settings, or persisted tournament data.

## Definition of done for behavioral changes

- Trace the complete flow before editing: domain types, tournament engine,
  creation/editing UI, local repository, Supabase repository, normalization,
  database constraints/migrations, and rendered views.
- Keep calculations in `src/domain/tournament-engine.ts` (or another pure domain
  module), not duplicated inside React components. UI components must consume
  the same tested domain functions used for champions and summaries.
- Preserve immutability: never mutate tournaments, matches, participants,
  settings, or arrays received by a domain function or React component.
- Every new behavior, changed rule, or fixed bug requires a deterministic
  regression test. Extend `src/domain/tournament-engine.test.ts` for tournament
  mathematics and add repository/component tests when the behavior lives there.
  If a code change genuinely needs no new test, explain why in the handoff.
- Never weaken assertions, remove meaningful cases, or lower the coverage
  thresholds in `vitest.config.mts` merely to make a change pass.
- Run `npm run check` before handoff. It must pass lint, TypeScript, the complete
  coverage-gated test suite, and the production Next.js build.
- For user-visible changes, run a browser smoke test and check the Next.js error
  overlay and browser console. For persisted behavior, verify a reload restores
  the same values and derived rankings.

## Adding or changing a tournament format

- Update the `TournamentFormat` type and every exhaustive format mapping,
  creation path, navigation label/icon, available tab, overview, details view,
  completion rule, progress calculation, and champion calculation that applies.
- Add mathematical cases for minimum, typical, boundary, tie, incomplete, and
  edited-result scenarios. Exercise both `higher` and `lower` score direction
  whenever the format supports them, plus negative and multi-digit values.
- Keep the supported 2–16 participant boundary covered where relevant. Verify
  odd/even schedules, one/two legs, byes, manual winner overrides, and reseeding
  whenever the new mode shares those concepts.
- Add cross-format invariants where possible instead of relying only on example
  scores (for example wins equal losses, total score-for equals score-against,
  goal differences sum to zero, and every expected pair occurs exactly once per
  leg).

## Persistence and backward compatibility

- Treat `Tournament` as a persisted public contract. New persisted fields need
  types, creation defaults, immutable update functions, and backward-compatible
  defaults in `normalizeTournament`.
- Verify local-storage and Supabase repositories both pass data through
  normalization and preserve the new field after a write/read or page reload.
- Determine whether Supabase schema constraints, columns, indexes, grants, RLS,
  or generated types must change. Add a timestamped migration for every required
  database change and keep the local migration history aligned with the remote
  history.
- Do not apply a remote migration, change production data, commit, push, or
  deploy unless the current user request authorizes that external action. When
  authorized, apply migrations before deploying code that depends on them and
  verify the resulting schema with a read-only query plus Supabase advisors.

## Release gate

- `vercel.json` intentionally runs `npm run check` as the Vercel build command.
  Keep this gate in place so a failing test, coverage threshold, typecheck, lint,
  or production build prevents deployment.
- After an authorized push, verify the deployment is for the expected commit,
  reaches `READY`, ran the test suite in its build logs, and has no new runtime
  errors before reporting completion.
