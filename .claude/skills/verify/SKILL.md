---
name: verify
description: Choose and run Nuvora's verification checks for the current change (lint, typecheck, test, build, seed:check, Prisma validation, Playwright smoke, browser checks) based on which workspaces changed, then report every result honestly. Use before calling a change done, before a gate report, or when asked to verify, test, or check the build.
---

# Verify

Runs the checks from `docs/engineering/VERIFICATION.md` (authoritative; read it if anything here is unclear) and reports them. This skill only checks: it doesn't fix, commit, or write to the database.

## Rules

- Run from the repository root with `pnpm`. Never read `.env*` files.
- Never run `db:migrate`, `db:seed`, `db:seed:demo`, or any other command that writes to the database.
- Don't skip, weaken, or delete tests, or update pinned values (seed record counts, migration checksums) to make a check pass. If `migrations-integrity.spec.ts` fails, an applied migration changed: stop and report it.
- Don't fix failures during verification unless the user asks. Report them first.
- Run each command once, in the foreground, one at a time. Keep going after a failure so the report is complete.

## 1. Detect what changed

```bash
git status --short
```

```bash
git diff --stat
```

Map the paths to the table in `docs/engineering/VERIFICATION.md#choose-the-checks`:

- Docs, skills, agents only → link/path and frontmatter checks; no build.
- `packages/shared` or anything in `apps/api/src` / `apps/web/src` → `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `apps/api/src/seed/content` → also `pnpm seed:check`, and `pnpm db:seed:dry-run` if the local database is up (read-only).
- `apps/api/prisma` → `pnpm db:validate`, then stop: schema changes need owner approval.
- `apps/web` UI, routing, or `messages/*.json` → also the browser smoke test and the UI checklist.

If the user asked for a full verification (for example before a gate), run everything in steps 2–3.

## 2. Automated checks

| Step | Command |
| --- | --- |
| Lint | `pnpm lint` |
| Types | `pnpm typecheck` |
| Content | `pnpm seed:check` |
| Tests | `pnpm test` (api unit + e2e with in-memory Prisma, web i18n parity) |
| Build | `pnpm build` (slowest; once per change) |
| Schema | `pnpm db:validate` (only if `apps/api/prisma` changed or for a gate) |

## 3. Browser checks (UI or routing changed)

1. Smoke test: `pnpm --filter @nuvora/web test:e2e` (installed Edge, reuses or starts the web dev server on :3000; content pages need the API on :4000 from `.claude/launch.json`). A new console warning is a failure.
2. Manual check in the built-in browser following `docs/engineering/VERIFICATION.md#browser-checks` and the [UI checklist](../../../docs/engineering/VERIFICATION.md#ui-checklist). If `next dev` is already running in another session, Next.js refuses a second one: reuse it or check a production build on another port, and say which.
3. Use a **guest** session for quiz submissions so demo learners' history stays intact.

For larger UI work, run the `visual-qa` skill instead of the short checklist.

## Report

1. Table: step, command, result (pass / fail / not run).
2. For each failure: the first relevant error lines with `file:line` and the likely cause in one sentence.
3. What was not run or not checked, and why.

Never report "all checks pass" if any step failed, was skipped, or only partly ran.
