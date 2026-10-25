# Roadmap, implementation sequence, and Definition of Done

Status: **Approved** (G0 baseline, owner, 2026-10-25). G0 was approved on Sun Oct 25, and D-17 and D-18 were decided the same day. Every day of delay comes out of the Knowledge Map graph view and polish, never the core loop.

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
| **Fri Oct 30** | 12:00 **feature freeze (G3)**. Afternoon: bug fixes, a11y and responsive pass, light/dark × 3-language check, demo rehearsal ×2, **record backup video** | Final content fixes only | Demo-ready build tagged |
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
2. Lint, typecheck, test, and build pass ([AGENTS.md](../../AGENTS.md#verification)).
3. Business logic it adds (scoring, mastery, recommendations, access checks) has unit tests.
4. UI it adds works in **light and dark**, in **tg, ru, and en** (no hard-coded strings), from **360 px** wide, and **by keyboard**.
5. It follows the [quality gates](../06-quality/quality-standards.md#quality-gates). No secrets, no new unjustified dependencies.
6. Docs changed if behaviour or a decision changed.
7. A teammate reviewed it.

The **MVP is done** when a person who didn't build it can run the demo storyline end to end in Tajik, Russian, and English, in both themes, on the demo laptop, with no console errors, and the backup video is recorded.
