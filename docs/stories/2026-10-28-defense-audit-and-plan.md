# Defense audit, plan, and the learner slice (Faroz phase 3)

Date: 2026-10-28 · Branch: `feat/faroz-rebrand` · Status: **learner slice implemented and verified; teacher and center planned** · Not committed.

## Context

The defense is Mon 2 Nov 2026 (implementation deadline Sun 1 Nov). The owner wants an honest full-stack MVP of the Faroz handoff ([FAROZ_HANDOFF.md](../02-design/FAROZ_HANDOFF.md)), backend and frontend equally, not a mock-up. Phases 1–2 (tokens, theme, logo, homepage, header/footer) were done earlier ([foundation](2026-10-28-faroz-foundation.md), [homepage](2026-10-28-faroz-homepage.md)). This story records the audit of what exists, the plan to the defense, and the first slice: the learner flow (handoff §5, flow 1).

## Audit (before this change)

| Feature (handoff) | Backend | Frontend |
| --- | --- | --- |
| Content API (subjects, topics, lessons, public quizzes) | Real: NestJS + Prisma + PostgreSQL, Zod contracts | Old-style pages `/subjects`, `/topics`, `/lessons`, `/quizzes` |
| Demo learners / guest sessions | Real: signed httpOnly cookie, `LearnerGuard` | Header learner menu |
| Quiz submission, server scoring, mastery, recommendations | Real (`recordAttempt`, ADR-0004) | Old quiz runner with results |
| CHECKPOINT (multi-topic) quiz / diagnostic | DB supports it; **seed format and loader did not** | None |
| JavaScript subject and B-12 demo data | **None** (only Python "informatics") | None |
| Re-open a past result (`GET /me/attempts/:id`) | **None** | None |
| Before/after per topic | **None** | None |
| Learner app `/app` (dashboard, quest, results, progress) | — | **None** |
| Teacher (`/teach`) and center (`/center`): roles, groups, assignments, invitations, permissions | **None**: no role, organization or group tables | **None** |
| PWA manifest | — | **None** |
| API-down error state | — | **Missing** on learner pages |

## Decisions (owner, in the chat, 2026-10-28)

- `pnpm db:seed` and `pnpm db:seed:demo` approved after green tests and a dry-run.
- Teacher and center data **without a migration**: staff and group roster defined in code, role from a signed server-side session, analytics computed from the real persisted attempts of group B-12. Mutations that cannot be persisted are labelled as demo.

## Changes (learner slice)

**Content format and loader** (`packages/shared/src/content.ts`, `apps/api/src/seed/check-content.ts`, `seed/load/*`)
- `CheckpointContentSchema` / `defineCheckpoint`: a subject-level quiz whose questions each name their `topic`. `ContentSet.checkpoints` is optional.
- `seed:check`: unknown or other-subject topic, duplicate keys, exactly one correct option, quiz slugs unique across topic and checkpoint quizzes, at least 3 questions per covered topic (data-model rule).
- Planner: one `planQuiz` for both kinds; a checkpoint quiz is stored with `topicId = null`, each question with its own topic. Still create/update only; moving an answered question to another topic is refused; a checkpoint missing from the files blocks the run.

**JavaScript content** (`apps/api/src/seed/content/javascript/`)
- Subject `javascript`, 5 topics (`js-variables`, `js-conditions`, `js-functions`, `js-arrays`, `js-objects`), one short lesson each, 2 real resources each (javascript.info, learn.javascript.ru, Eloquent JavaScript), a 5-question topic quiz each (practice/retest, new questions). The Arrays quiz is the handoff's Arrays retest (same 5 items, new answer options).
- `javascript-diagnostic`: the handoff's 20 questions in the same order with the same options and correct answers; new explanations in en/ru/tg. All languages `needs-review` (Tajik especially). Python content untouched.

**Demo data** (`apps/api/src/seed/demo/b12-cohort.ts`, `run.ts`)
- Group B-12's 26 students (24 submitted) as demo learners. Their diagnostic answers and Arrays retest results from the handoff are replayed through `recordAttempt()` on Oct 6 and Oct 13, 2026. A wrong retest answer is recorded as the first wrong option (the handoff only says right/wrong).
- The profile picker lists only Amina Rahimova, Farzona and Rustam (`PICKER_PROFILES`).

**API** (`packages/shared/src/learning-api.ts`, `apps/api/src/progress/*`, `apps/api/src/quizzes/*`)
- `GET /me/attempts/:attemptId`: the learner's own attempt, rebuilt from stored answers; someone else's id → 404.
- `POST /quizzes/:slug/attempts` now returns the same stored-attempt view (adds `quizKind`, `subject`, per-question `topic`).
- `GET /me/progress`: per topic `lesson`, `quiz`, `before` (first checkpoint attempt) and `after` (latest later attempt), from `AttemptAnswer` via the pure `compareTopics()`; `checkpoints` with the latest attempt; attempts with kind and counts.

**Web** (`apps/web/src/app/[locale]/app/*`, `apps/web/src/features/app/*`)
- Public pages moved into the `(site)` route group (URLs unchanged) so `/app` gets its own shell: 248 px sidebar, top bar with menu below 900 px.
- `/app` dashboard (next quest: diagnostic, then the weakest topic as lesson → retest; skills; results so far; read next), `/app/quest/[quizSlug]` (intro, one question at a time, question jump, review, duplicate-submit guard, answers kept in sessionStorage, expired session keeps the answers and asks to choose a learner instead of silently moving them to a new guest), `/app/results` and `/app/results/[attemptId]` (score ring, what this shows with caveats, next quest, by-topic squares, question review), `/app/progress` (before/after bars, topics table, test history). Loading, empty, error and "server unreachable" states with retry.
- XP, levels, streaks and badges from the artboards are **not shown**: nothing in the backend records them, so they would be fabricated.
- **Tajik font (owner decision, 2026-10-28):** Unbounded has no glyphs for ҳ ҷ ӣ ғ қ ӯ (measured in the browser: they fell back to another font mid-word). On `lang=tg` pages headings, buttons and the wordmark use Inter (`globals.css`); ru and en keep Unbounded. Checked at 390 px: Tajik `h1` and buttons computed as Inter, Russian `h1` as Unbounded.
- Header and homepage CTAs now lead to `/app`. Texts in en/ru/tg (`App` namespace); Tajik and Russian need native review.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Lint | `pnpm lint` | pass |
| Types | `pnpm typecheck` | pass |
| Tests | `pnpm test` | pass: api 13 files / 126 unit tests, 3 files / 51 e2e tests; web i18n parity 3 |
| Build | `pnpm build` | pass |
| Content | `pnpm seed:check` | pass: 2 subjects, 11 topics, 1 checkpoint, 69 questions, 0 errors (warnings: translations need review) |
| Seed plan | `pnpm db:seed:dry-run` | creates only (1 subject, 5 topics, 4 prerequisites, 5 lessons, 10 resources, 6 quizzes, 45 questions, 180 options), 0 updates |
| Seed (approved) | `pnpm db:seed` | applied in one transaction |
| Demo reset (approved) | `pnpm db:seed:demo` | applied; B-12 totals printed match the handoff (Amina 13/20, Arrays retest 4/5) |
| Handoff numbers | `b12-cohort.spec.ts` | pass: every student total, per-question counts, topic totals 92/81/58/44/63, 328/480, average 68%, retest 13/9/5/6/11 |
| Browser e2e | Playwright (Edge) on the production build (:3002, temporary config, deleted) | 4 passed: language/theme ×2, guest diagnostic → results 13/20 → Arrays retest 4/5 → progress before/after after reload, attempt isolation (401 without session, 404 for another learner) |
| Browser smoke on dev | `pnpm --filter @nuvora/web test:e2e` (dev server :3000, Edge) | 4 passed after two fixes: the homepage's `panels` array (from 0266f2f) had no keys, which React dev reports as a console error, now keyed fragments; the journey test's "Next" locator made exact (the dev overlay has a "Next.js" button). One earlier parallel run timed out on dev compile; reruns passed |
| Browser check | built-in browser, production build | `/ru/app`, results, progress at 1440 dark; `/tg/app` at 390 light: no horizontal scroll; HUD card fixed for light theme |
| Formatting | `pnpm format:check` | **fails on 196 files, including files this change did not touch** (pre-existing) |

Not run: Lighthouse, full keyboard pass, reduced-motion pass, `visual-qa` skill, `/code-review`, `/security-review`.

## Known limitations and follow-ups

- `pnpm format:check` was already failing on most files (likely line endings on Windows); not fixed here.
- Next phases (below) are planned, not started: teacher, center, PWA, release QA.
- Amina's history already includes the Oct 13 retest, so a live demo of the full loop uses a guest; Amina shows the finished before/after.

## Plan to the defense

1. **Learner** — done in this story.
2. **Teacher** (no migration): code-defined staff and roster, signed staff session (role from the server), read endpoints over the B-12 attempts (group totals, per-question analytics, misconceptions, students answer by answer), teacher sees only own groups. Assign practice / builder only if persisted, otherwise labelled demo. Screens TDashboard, TClasses, TStudents, TInsights, TAnalytics, then TAssessments/TBuilder.
3. **Center**: aggregate-only endpoints (group totals, participation; never individual scores or answers, never who got targeted practice), role-aware navigation, denied state, server-enforced permissions with e2e 401/403 tests.
4. **Polish + PWA**: manifest and icons, no service-worker caching of private data, states, 390/768/1440, both themes, three languages, reduced motion.
5. **Release QA**: all checks, Playwright journeys (learner + rejected teacher/center access), `visual-qa`, defense checklist separating real from prototype.
