# Verification

Status: **Adopted 2026-10-26.** This is the authoritative pre-completion checklist: which checks a change needs and how to report them. The quality gates themselves (Q1–Q6, release gate) are in [quality-standards.md](../06-quality/quality-standards.md#quality-gates). The `verify` skill ([`.claude/skills/verify/SKILL.md`](../../.claude/skills/verify/SKILL.md)) runs this document.

Rule: a change is not done because code was written. It is done when the checks below pass, or when every failure and skipped check is reported.

## Commands

All from the repository root. Each root script runs `prep` first (builds `packages/shared`, generates the Prisma client). None of these write to the database.

| Check | Command | Covers | Needs |
| --- | --- | --- | --- |
| Lint | `pnpm lint` | oxlint (api), ESLint (web) | — |
| Types | `pnpm typecheck` | `tsc --noEmit` in every package, `next typegen` for web | — |
| Tests | `pnpm test` | api Vitest unit + e2e (`*.e2e-spec.ts`, Prisma replaced by in-memory fakes), web i18n key parity (`node --test`) | — |
| Build | `pnpm build` | Production build of api and web | — |
| Content | `pnpm seed:check` | Seed content: 3 languages, one correct option per question, prerequisites, no cycles, unique slugs/keys | — |
| Schema | `pnpm db:validate` | Prisma schema validity | — |
| Migrations | `pnpm db:status` | Applied vs. pending migrations (reads the DB) | Local PostgreSQL |
| Seed plan | `pnpm db:seed:dry-run` | What `db:seed` would change; blocks unsafe changes (reads the DB, writes nothing) | Local PostgreSQL |
| Browser smoke | `pnpm --filter @nuvora/web test:e2e` | Playwright on the installed Edge: language and theme switching, `<html lang>`, clean console | web on :3000 (started or reused), API on :4000 |
| Formatting | `pnpm format:check` | Prettier | — |

Never run `db:migrate`, `db:seed`, or `db:seed:demo` as a "check": they write. Never skip, weaken, or delete a test, or update pinned values (record counts, migration checksums) just to make a check pass. If `migrations-integrity.spec.ts` fails, an applied migration changed: stop and report.

## Choose the checks

Find what changed with `git status --short` and `git diff --stat`, then:

| Changed | Run while iterating | Run before handoff |
| --- | --- | --- |
| Docs, skills, agents only (`docs/`, `*.md`, `.claude/`) | Link and path check (below) | Same. No build needed |
| `packages/shared` | `pnpm typecheck` | lint, typecheck, test, build (both apps consume it) |
| `apps/api/src` (not seed) | `pnpm --filter @nuvora/api test` | lint, typecheck, test, build |
| `apps/api/src/seed/content` | `pnpm seed:check` | seed:check, test (record counts are pinned), and `db:seed:dry-run` when the DB is available |
| `apps/api/prisma` | `pnpm db:validate` | Stop: schema changes need owner approval and a new migration ([AGENTS.md](../../AGENTS.md#commands)) |
| `apps/web` (logic, routing) | `pnpm --filter @nuvora/web lint`, `pnpm typecheck` | lint, typecheck, test, build, browser smoke, browser check |
| `apps/web` UI or `messages/*.json` | as above | as above + the [UI checklist](#ui-checklist) (`visual-qa` skill for larger UI work) |
| Dependencies / lockfile | — | Everything, plus a note on why the dependency is needed |

Run each command once, in the foreground, and keep going after a failure so the report is complete.

## Browser checks

- Use the built-in browser with `.claude/launch.json` (`api` on :4000, `web` on :3000). If another session already runs `next dev` in `apps/web`, Next.js 16 refuses a second dev server in the same folder: reuse that server, or check a production build instead: `pnpm build`, then the `web-prod` entry in `.claude/launch.json` (`next start` on :3001, moves to a free port if taken). Say which you used.
- The API needs the local database. Pages that read content show an error state without it.
- `pnpm build`, `pnpm seed:check`, and the `db:seed*` scripts run `nest build`, which cleans `apps/api/dist` under a running `api` dev server. The watcher crashes and the web app gets `ECONNREFUSED` until it restarts. After those commands, check `http://localhost:4000/api/v1/health` (and restart `api` if needed) before judging a page.
- Learner flows (sessions, quiz submissions) write learner rows. Use a **guest** session for test submissions so demo learners' scripted history stays intact. Guests are removed by `pnpm db:seed:demo`, which itself needs approval.
- Check the browser console and network panel: no errors or warnings, and no quiz correctness or explanations in responses before submission.

## UI checklist

Report each item as checked or not checked:

- [ ] Light and dark themes both readable. No hard-coded colours (tokens from [design-system.md](../02-design/design-system.md)).
- [ ] `ru` (default), `tg`, and `en`: no missing keys, no clipped Russian/Tajik text, `<html lang>` correct, fallback content labelled.
- [ ] 360–375 px wide: no horizontal scroll, header fits, touch targets ≥ 44 px. Also tablet (768 px) and desktop (≥ 1280 px).
- [ ] `prefers-reduced-motion: reduce`: decorative motion stops, content and layout stay the same.
- [ ] Keyboard only: skip link, visible focus, quiz options (arrow keys + Space), all buttons and links reachable.
- [ ] Browser console: no errors or warnings on the pages touched.
- [ ] Loading, empty, and error states render and are translated.
- [ ] Homepage and brand surfaces match [VISUAL_EXPERIENCE.md](VISUAL_EXPERIENCE.md): no generic card-grid landing page.
- [ ] Answer secrecy: before submission, quiz responses contain no correct-option flags or explanations.

Release-level checks (Lighthouse targets, network-disconnected demo run, Tajik copy review) are in the [release gate](../06-quality/quality-standards.md#quality-gates).

## Mobile app (Android) checklist

Automated checks for `apps/mobile`: `pnpm --filter @nuvora/mobile typecheck`, `test` and `bundle:android` (Metro export; proves the code bundles, not that it runs). The Expo web preview (`mobile-web` in `.claude/launch.json`, port 8081) covers screens and API calls but not native features (secure storage, biometrics, push, background). A real run needs a phone or emulator. Say in the report which of the two was used, and never report a device check that did not happen.

**Setup.** Expo Go cannot receive push notifications on Android, so push needs a development build (`eas build --profile development` or `npx expo run:android` with the Android SDK). For screens without push, Expo Go works: `pnpm --filter @nuvora/mobile exec expo start`, phone and laptop on the same Wi-Fi, `EXPO_PUBLIC_API_URL=http://<laptop-ip>:4000/api/v1`; the API must accept that origin (bearer requests are not origin-checked). Emulator: the default API URL `http://10.0.2.2:4000/api/v1` reaches the laptop.

Run each item in dark and light, and at least once in ru, tg and en:

- [ ] **Sign-in and restore:** demo learner, guest, teacher, center; password sign-in with the two-factor code. Kill the app and reopen: the session comes back without signing in, and the first screen loads data (no empty teacher screen).
- [ ] **Roles:** learner sees the learner tabs; teacher sees groups, exams, live board; center sees group totals and participation only (no exams tab, no single learner's score).
- [ ] **PIN and biometrics:** set a PIN; reopen; a wrong code shows the attempts left; five wrong codes sign out. Turn on biometrics (if the phone has it); background the app for more than 60 s → locked; unlock with the fingerprint.
- [ ] **Offline lessons:** save a lesson; airplane mode; the lesson and its practice open; remove the download.
- [ ] **Offline practice and sync:** in airplane mode answer the practice → "queued"; kill the app; reopen online → the home card shows it sent, and the server has exactly one attempt (`quiz_attempts` row with that `idempotencyKey`).
- [ ] **Idempotent retry:** send practice, cut the network while the request is in flight (or kill the API right after it answers); after reconnecting the queue sends again and the result is the same attempt (response header `Idempotent-Replayed: true`), not a second one.
- [ ] **Online exam:** start, answer, background the app (teacher's board shows the signal), come back, submit; reopen the attempt → the result, not "no attempts left".
- [ ] **Network loss during the exam:** airplane mode mid-exam → "No network, answers queued"; answer two questions; back online → "All answers saved" within 10 s; the teacher sees both answers.
- [ ] **Push permission:** the home card explains first; the system dialog appears only after "Turn on". Settings → Notifications shows "On"; `push_devices` has the token with this session. "Turn off on this phone" removes it. Denied permission shows the "open phone settings" button.
- [ ] **Push delivery** (only with `PUSH_DELIVERY=expo` and a build with Firebase credentials): a teacher publishes a test → the learner's phone shows "New test"; a learner submits → the teacher sees "Work submitted" with counts only. Foreground: a banner shows. Background and killed app: tapping opens the tests list or the live board.
- [ ] **Sign-out:** after sign-out, publishing a test sends nothing to this phone (`notification_deliveries.outcome` is `no-devices`).
- [ ] **Layout:** safe areas on a phone with a notch and gesture bar; the keyboard does not cover the sign-in fields or the two-factor code; Android back button and back swipe behave (the exam screen does not close on a swipe).

## Docs and tooling changes

- Every linked path exists (`docs/`, `.claude/`, scripts named in docs exist in a `package.json`).
- Skill and agent files have valid frontmatter (`name`, `description`; agents also `model`, `tools` where restricted).
- `pnpm exec prettier --check <changed JSON files>` (`.prettierignore` excludes Markdown).

## Report format

1. Table: check, command, result (pass / fail / not run).
2. For each failure: the first relevant error lines with `file:line` and the likely cause in one sentence.
3. What was not run or not checked, and why (no database, port in use, docs-only change).
4. Never write "all checks pass" if a step failed, was skipped, or only partly ran.
