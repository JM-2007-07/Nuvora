# Roadmap, implementation sequence, and Definition of Done

Status: **Approved** (G0 baseline, owner, 2026-10-25). G0 was approved on Sun Oct 25, and D-17 and D-18 were decided the same day. The [G4 sub-milestones](#g4-user-facing-mvp) were added on 2026-10-26. Every day of delay comes out of the Knowledge Map graph view and decorative polish, never the core loop or the homepage's identity.

## Principles

- **Vertical slices.** Get a rough version of the whole loop working first, then improve it. A working loop on Wednesday beats perfect lessons with no quiz.
- **Content runs in parallel with code.** Writing and translating six Informatics topics into three languages is the riskiest track. It starts Sunday evening.
- **Demo path first.** Every task is judged by whether it moves the [demo storyline](../00-product/mvp-scope.md#demo-storyline-scripted-verified-on-friday) closer to a flawless run.

## Schedule to the presentation

| Day | Engineering | Content & design | Gate / outcome |
| --- | --- | --- | --- |
| **Sun Oct 25** | Phase 0 docs and brand (done). Owner decides D-17 and D-18 and creates the local database role and databases | Write topic 1 (Variables) in full as the **template**: lesson, 4 questions, resources | **G0** approved |
| **Mon Oct 26** | [G1 checklist](#gate-g1-checklist-mon-oct-26): walking skeleton. Then the Prisma schema and seed format | Topics 2–3 in the first writing language. Translate topic 1 | **G1** by 20:00, or the [fallback decision](../01-architecture/adr/0001-core-technology-stack.md#is-nestjs--nextjs-achievable-by-monday). **G2**: schema + seed format |
| **Tue Oct 27** | Seed script + integrity checks. API: catalog, topics, lessons, quiz delivery, attempt scoring (+ unit tests) | Topics 4–6. Translations of topics 2–3 | Loop works **via API** |
| **Wed Oct 28** | Identity: demo profiles, guest mode, cookie session. Web: subjects, subject, topic, lesson, quiz, results with explanations | Translations of topics 4–6. Demo learner history script | **Rough loop works in the browser** |
| **Thu Oct 29** | Mastery + recommendations (+ unit tests), progress page, mark-complete, Knowledge Map (list view first, then graph). Demo reset command | All content complete in tg, ru, en. Translation review by a second person | Full storyline works |
| **Fri Oct 30** | 12:00 **feature freeze** (a milestone, not a gate). Afternoon: bug fixes, a11y and responsive pass, light/dark × 3-language check, demo rehearsal ×2, **record backup video** | Final content fixes only | Demo-ready build tagged |
| **Sat Oct 31** | Presentation. Reseed, then no code changes on the day | — | 🎤 |

### Team split (assign names at G0)

- **Backend owner:** schema, seed, API, scoring, recommendations, identity.
- **Frontend owner:** shell, i18n, theme, pages, map.
- **Content owner(s):** lessons, quizzes, resources, all three languages, presentation narrative.

With fewer people, content still needs an owner. It can't be left until the end.

## Gate G1 checklist (Mon Oct 26)

G1 proves the stack works end to end on the demo laptop. Required items are what later days build on. Deferred items are added when the feature that needs them is built.

**Required for G1**

| # | Item |
| --- | --- |
| 1 | Workspace (`apps/web`, `apps/api`, `packages/shared`) with the D-17 package manager and its version pinned |
| 2 | TypeScript strict, per-app linters ([AGENTS.md](../../AGENTS.md#per-app-tooling)), Prettier. Root scripts `dev`, `lint`, `typecheck`, `test`, `build` all pass ([AGENTS.md](../../AGENTS.md#commands)) |
| 3 | `.gitignore` (incl. `.env*` except `.env.example`), `.env.example`, Zod-validated env config in both apps |
| 4 | Prisma connected to the local PostgreSQL (D-18). One migration applied, and the API answers `GET /api/v1/health` with a database check |
| 5 | API basics: `/api/v1` prefix, CORS for `WEB_ORIGIN`, global error filter with the [error shape](../03-api/api-conventions.md#errors), Zod validation pipe |
| 6 | Web basics: `[locale]` routing with `tg` default and no browser detection, language switcher, message files with a key-parity test |
| 7 | Theme: next-themes, `tokens.css` mapped to shadcn variables, Logo component (light/dark), favicon, Inter (`latin`, `cyrillic`, `cyrillic-ext`) |
| 8 | **Walking skeleton:** a web page shows data the API read from PostgreSQL, in all three locales and both themes |
| 9 | One passing Vitest test in `apps/api` |

**Deferred from G1** (added on the day the feature needs it): shadcn components other than `button` and `dropdown-menu` · TanStack Query provider (Wed) · Motion (Thu/Fri) · react-markdown (Tue/Wed) · identity and sessions (Wed) · seed script (Tue) · PNG/ICO icon exports · CI service · Playwright · any hosting.

## Gate G2 checklist

| # | Item |
| --- | --- |
| 1 | Shared Zod schemas: `LocalizedText`, enums, and seed content types (`packages/shared`) |
| 2 | Prisma schema for the 13 MVP entities in [data-model.md](../04-data/data-model.md). No "Later" tables |
| 3 | Migration SQL created from the schema and **reviewed by the owner before it is applied** to `nuvora_dev` |
| 4 | Seed content format: one TypeScript file per topic in `apps/api/src/seed/content/`, no new dependencies |
| 5 | `pnpm seed:check` (no database): all three languages, ≥ 3 questions per topic quiz, exactly one correct option per question, valid prerequisites, no cycles, unique slugs and keys. Broken fixtures prove each failure |
| 6 | Template topic "Variables and data types" in tg, ru, en. Tajik marked `needs-review` |
| 7 | **Tajik copy review** of `apps/web/messages/tg.json` and the template topic by a Tajik-speaking teammate |
| 8 | Playwright smoke test (installed Edge): language and theme switching, `<html lang>`, clean console |
| 9 | Lint, typecheck, test, build pass |

The content loader (`db:seed`, writing to the database) follows on Tuesday per the schedule.

## Gate status

| Gate | Scope | Status (2026-10-26) |
| --- | --- | --- |
| G0 | Phase 0 docs, brand, decisions | ✅ Approved 2026-10-25 |
| G1 | Walking skeleton ([checklist](#gate-g1-checklist-mon-oct-26)) | ✅ Approved 2026-10-25 |
| G2 | Schema, migrations, seed format, `seed:check`, template topic ([checklist](#gate-g2-checklist)) | Schema and migrations applied with approval 2026-10-25. **Item 7, the Tajik copy review, is still open** |
| G3 | Seed loader (`db:seed`, `db:seed:dry-run`) and read-only Content API, verified against PostgreSQL | ✅ Approved 2026-10-25 |
| G4 | User-facing MVP ([sub-milestones](#g4-user-facing-mvp)) | In progress |
| Feature freeze | Fri Oct 30, 12:00. Bug fixes and content only afterwards. Not a gate number | Upcoming |

## G4: user-facing MVP

G4 is reported to the owner as one gate, but it is planned and verified as five sub-milestones. A and B can run in parallel with C and D; E closes the gate. The homepage (B) and the complete learning loop (D) are core deliverables: if time runs short, cut decorative extras inside B and the Knowledge Map graph view, not the homepage's identity or the loop.

Status uses: **planned** (not started) · **implemented** (code exists, uncommitted or committed) · **verified** (named checks passed, recorded in a story).

| ID | Milestone | Depends on | Acceptance criteria | Status (2026-10-26) |
| --- | --- | --- | --- | --- |
| **G4-A** | **Content expansion.** All six Informatics topics ([MVP content](../00-product/mvp-scope.md#mvp-content)) with prerequisites, one lesson, resources, and a 4-question quiz each, in tg/ru/en. Optional checkpoint quiz (MVP-Should) | G3 | `seed:check` passes; record counts in the seed test updated on purpose; every language `needs-review` until a real review; `db:seed:dry-run` shows only creates/updates; no question meaning changed in place | Six topics, 6 lessons, 24 questions, 11 resources implemented and `seed:check` passes. All languages `needs-review`. Checkpoint quiz planned. Tajik/Russian review open |
| **G4-B** | **Distinctive Nuvora homepage.** The knowledge-core concept from [VISUAL_EXPERIENCE.md](../engineering/VISUAL_EXPERIENCE.md) | G3 (data), D-22 for any new library | All [implementation checklist](../engineering/VISUAL_EXPERIENCE.md#implementation-checklist-g4-b) items; `visual-qa` and `design-review` pass at 375/768/1280 px × tg/ru/en × light/dark; reduced motion and no-WebGL paths verified; Lighthouse mobile measured; no generic card grid | First SVG pass implemented (uncommitted). D-22 approved and `motion` 14.6.0 installed 2026-10-26. Research brief, animation plan, and colour audit drafted ([HOMEPAGE_BRIEF.md](../engineering/HOMEPAGE_BRIEF.md)). Redesign not started; not verified against the contract |
| **G4-C** | **Subject and lesson experience.** Subject page with ordered topics and status, topic page with lessons/resources/quiz, lesson page (Markdown, mark complete, next step), using the Content API and shared schemas | G3 | FR-CAT-01..03, FR-LES-01..03, FR-RES-01..02; server-rendered content; loading/empty/error states translated; UI checklist in [VERIFICATION.md](../engineering/VERIFICATION.md#ui-checklist) | Implemented (uncommitted). Browser-checked on 2026-10-26 in en/ru, light, 375 px. Full checklist not run |
| **G4-D** | **Complete learning loop.** Demo profiles and guest sessions, quiz taking and submission, server scoring, saved attempts, explanations after submission, mastery, progress page, recommendations (weak prerequisites first), demo reset | G4-C | FR-QUIZ-01..06, FR-ADAPT-01..03, FR-PROG-01..02, FR-AUTH-01..04; no answers before submission; `/me/*` from the session only; unit tests for scoring/mastery/recommendations; API tests for session, attempts, progress | Implemented (uncommitted) with unit tests and e2e tests (in-memory Prisma). Guest quiz run verified in the browser on 2026-10-26. Not yet: API tests against `nuvora_test` with cross-learner isolation, Knowledge Map (FR-MAP), FR-JOUR-01 trend |
| **G4-E** | **Verification and demo readiness** | A–D | The [demo storyline](../00-product/mvp-scope.md#demo-storyline-scripted-verified-on-friday) runs end to end in tg/ru/en and both themes; Playwright smoke green; reduced motion, keyboard, loading/error states, 375 px; console clean; Lighthouse targets; `/code-review` and `/security-review` once for the gate; story written | Planned. Playwright smoke passes again (2026-10-26: the test still expected the old G1 status heading; it now reads the homepage headline from the message files) |

## Faroz defense phases (from 2026-10-28)

The owner switched to the Faroz handoff (D-23) for the defense on **Mon 2 Nov 2026** (implementation deadline Sun 1 Nov). These phases continue G4; audit and details in the [defense story](../stories/2026-10-28-defense-audit-and-plan.md).

| Phase | Scope | Status (2026-10-28) |
| --- | --- | --- |
| F1–F2 | Tokens, theme, logo, homepage, header/footer | Implemented and verified, pushed |
| F3 Learner | CHECKPOINT seed format; JavaScript subject + 20-question diagnostic; B-12 cohort replayed from the handoff; `GET /me/attempts/:id`; before/after in `/me/progress`; `/app` dashboard, quest, results, progress | Implemented and verified (not committed). `db:seed` and `db:seed:demo` applied with approval |
| F4 Teacher | Code-defined staff/roster (no migration, owner decision 2026-10-28), signed staff session, analytics from real B-12 attempts, teacher screens | Core implemented and verified ([story](../stories/2026-10-28-teacher-workspace.md)): `/teach` dashboard, gap insights, student answers. **Assessments list and 5-step builder** (bank, editor, preview, publish/unschedule) implemented and verified 2026-10-29 ([story](../stories/2026-10-29-teacher-assessments.md)); learners can't take them yet. Materials, question-bank page, assign practice not built |
| F5 Center | Aggregate-only endpoints, role-aware nav, denied state, server-enforced permissions, 401/403 tests | Core implemented and verified ([story](../stories/2026-10-28-center-workspace.md)). Group wizard, invitations, permission editing not built |
| F6 Polish + PWA | Manifest/icons, states, 390/768/1440, themes, locales, reduced motion | Manifest and icons done, no service worker; 390 px, themes, keyboard spot-checked ([story](../stories/2026-10-28-defense-readiness.md)) |
| F7 Release QA | All checks, Playwright journeys, `visual-qa`, defense checklist (real vs prototype) | Checks and 8 Playwright journeys pass; checklist written. Open: `/code-review`, `/security-review`, `visual-qa`, Lighthouse, Tajik/Russian review |

## Implementation sequence (dependency order)

1. Walking skeleton (G1)
2. Shared schemas: locales, `LocalizedText`, enums
3. Prisma schema + seed format (G2)
4. Seed script with integrity checks + topic 1 content
5. Catalog/topic/lesson read API → web pages
6. Quiz delivery + attempt submission + server scoring (tested) → quiz and results pages
7. Identity: demo profiles, guest mode, cookie session (ADR-0006)
8. Mastery + recommendations (tested) → results recommendations + progress page
9. Demo learner history in the seed + demo reset
10. Knowledge Map: list view, then SVG graph
11. Motion polish, accessibility and responsive pass, rehearsal, backup video

## After the presentation (not scheduled)

Real accounts, goals and achievements, adaptive question selection, content authoring UI, more subjects, hosted deployment, analytics with a privacy review. See [mvp-scope.md](../00-product/mvp-scope.md#deferred-after-the-presentation).

## Definition of Done

A task or PR is **done** when all of the following are true:

1. It meets the acceptance criteria of the requirement IDs it claims ([requirements.md](../00-product/requirements.md)).
2. The checks [VERIFICATION.md](../engineering/VERIFICATION.md) selects for the change pass (lint, typecheck, test, and build for any code change).
3. Business logic it adds (scoring, mastery, recommendations, access checks) has unit tests.
4. UI it adds works in **light and dark**, in **tg, ru, and en** (no hard-coded strings), from **360 px** wide, and **by keyboard**.
5. It follows the [quality gates](../06-quality/quality-standards.md#quality-gates). No secrets, no new unjustified dependencies.
6. Docs changed if behaviour or a decision changed.
7. A teammate reviewed it.

The **MVP is done** when a person who didn't build it can run the demo storyline end to end in Tajik, Russian, and English, in both themes, on the demo laptop, with no console errors, and the backup video is recorded.
