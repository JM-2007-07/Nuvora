# 2026-10-29: Teacher assessments list and builder

Status: **implemented and verified** (browser on a production build, en/ru/tg, dark/light, 390 px; Playwright). Learners taking teacher assessments: **not built**.
Gate: G4 (Faroz phase F4)   Design: handoff TAssessments, TBuilder (§4, flow 2)   Decisions: D-23

## Context

The handoff's teacher flow 2 ends in Assessments and the builder ("create, preview, publish Functions check"). Neither existed: the teacher workspace had a dashboard, gap insights and student answers only.

## Decisions (owner, in the chat, 2026-10-29)

- **New tables** `assessments` + `assessment_questions` (migration `20261029120000_teacher_assessments`, additive). Not the seeded `quizzes` tables: the seed loader treats any database quiz missing from the seed files as a blocking error. SQL shown before applying; applied with approval; SHA-256 pinned.
- **Real clock.** Status is derived from `publishedAt`, `opensAt`, `closesAt`; a new draft opens tomorrow 16:00 (the design's "Oct 19" is not hard-coded).
- **Demo draft through `db:seed:demo`**: Dilshod's "Functions — return vs console.log" (bank Q9, Q10, Q16 + the design's two new questions with their missing translations). Run with approval.
- **Reference rows** (B-14 retest and diagnostic, B-12 retention check) are design figures, labelled "reference", with no actions.
- Main session only, no subagents.

## Changes

- **Shared** `packages/shared/src/assessment-api.ts`: draft/assessment/list/bank schemas and `assessmentChecks()` / `canPublish()`, used by both the builder (checklist) and the server (refusal).
- **API** `apps/api/src/assessments/`: pure rules (`assessment-rules.ts`: status, default schedule, code split, bank copy, reference rows), service and controller under `/teach` (list, create, get, save, publish, unschedule, duplicate, delete draft, bank). Teacher role and own groups only (403), someone else's id → 404, live/closed → 409, failed checks → 422.
- **Demo** `apps/api/src/seed/demo/demo-assessments.ts`, step 4 in `seed/demo/run.ts`.
- **Web** `apps/web/src/features/teach/assessments/` (list, builder, questions step with editor and bank dialog, preview, confirm dialog), routes `/teach/assessments` and `/teach/assessments/[id]` (`new` = new draft), "Assessments" in the teacher nav, message part `messages/parts/assess/{en,ru,tg}.json` (ru/tg AI drafts).
- **Fix found on the way:** at 390 px the long Tajik workspace chip covered the "Фароз" name in the mobile top bar (all workspaces); the chip now truncates (`features/app/workspace-shell.tsx`).

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | pass |
| `pnpm test` | api 161 unit (13 new + migration pin) + 84 e2e (9 new), web i18n parity 3 |
| `pnpm --filter @nuvora/web build` | pass |
| `pnpm db:migrate` / `db:status` | applied; schema up to date |
| `pnpm db:seed:demo` | removed 45 guests; Amina 13/20 and 4/5; draft recreated (5 questions) |
| Live API (real DB) | B-12 diagnostic 24/26 · 68%, Arrays retest 13/15 · 68%, Functions 58%, bank Q9 9/24, Q10 12/24, Q16 16/24, retest "push" 8 of 13 missed — all match the handoff |
| Browser (prod build, 1440 px) | list, builder questions (EN/RU/TJ chips as in the design), bank dialog, editor validation, publish → scheduled → unschedule, new draft from scratch (URL switches to the id, step kept), delete; console clean |
| Browser | ru list and builder; light theme; tg at 390 px without horizontal scroll |
| Playwright (Edge, prod build) | 12 passed with 1 worker (2 new). In parallel, 2 older specs timed out under machine load and passed when re-run alone |

Not run: `pnpm build` for the API and `seed:check` (another chat's API watcher uses `apps/api/dist`; content unchanged), Lighthouse, full keyboard pass, native-speaker review of the new ru/tg texts.

## Implications

- Security: every endpoint is teacher-only and scoped to the teacher's groups on the server; correct options are only returned to the owning teacher. No learner endpoint exposes assessments.
- Localization: question text is per language; students see English where a translation is missing (shown as a warning before publishing).

## Known limitations and follow-ups

- Learners can't take teacher assessments yet (needs an attempt table for them, a migration, and a learner quest view); "Submitted" and "Average" stay empty for stored assessments.
- Reference rows keep the design's dates, so "Retention check · opens 27.10" shows as scheduled although the date has passed.
- The standalone question-bank page (`/teach/bank`), materials and "assign practice" are still not built.
- Without `SESSION_SECRET`, every API restart signs everyone out (known; set it in `apps/api/.env` for the defense).
