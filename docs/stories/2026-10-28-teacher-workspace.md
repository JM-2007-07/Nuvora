# Teacher workspace (Faroz phase 4)

Date: 2026-10-28 · Branch: `feat/faroz-rebrand` · Status: **core implemented and verified** · Follows [defense audit and learner slice](2026-10-28-defense-audit-and-plan.md).

## Context

Handoff flow 2 (teacher): dashboard → B-12 → gap insights (Arrays) → students. The owner decided on 2026-10-28 that teacher and center data use **no migration**: staff and groups are defined in code, the role comes from a signed server-side session, and analytics are computed from the real stored attempts of group B-12.

## Decisions

- **Staff in code** (`apps/api/src/staff/demo-org.ts`): Dilshod Karimov (teacher of B-12, B-14, B-16), Komila Rasulova (coordinator), Farhod Jalilov (center admin); the six handoff groups. Only B-12 has a roster of real demo learners. Other groups carry the handoff's reference figures and are returned with `recorded: false`; the UI labels them "reference figures from the design; not recorded in this demo".
- **Staff session**: cookie `fz_staff`, value `staff:<slug>` signed with the same HMAC key as learner sessions, httpOnly, SameSite=Lax. A learner cookie cannot pass as staff and vice versa (tested).
- **Server-side authorization**: `StaffGuard` + `@Roles('TEACHER')` on the `/teach` controller; group ownership checked in the service (another teacher's group → 403, unknown → 404). Client checks are UI only.
- **Not built (no persistence without a migration)**: assessments list and builder, materials, assign practice, retention check scheduling. Nothing on the screens pretends these were saved.

## Changes

- Shared: `packages/shared/src/staff-api.ts` (Staff, TeacherOverview, GroupAnalytics, StudentAnswers).
- API (NestJS): `staff/` (demo org, guard, session controller, module), `teaching/` (pure `groupAnalytics()`, service, controller, module). Endpoints in [api-conventions.md](../03-api/api-conventions.md).
- Web: shared `WorkspaceShell` (learner app and staff use the same sidebar shell), `/teach` (next step in the loop: retest before/after and the hardest retest question; classes; who needs attention; topic map), `/teach/insights` (topics weakest first → questions weakest first → option counts → students under 60% → student × topic map with the retest column), `/teach/students/[slug]?group=` (answer by answer with option texts), staff chooser, access-denied state (handoff CDenied). Texts in en/ru/tg (`Teach` namespace; ru and tg need native review). Cards now shrink inside grids (`min-w-0`), which fixed a 580 px page width at 390 px.

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | pass |
| `pnpm test` | pass: api 132 unit, 62 e2e; web i18n parity 3 |
| `group-analytics.spec.ts` (handoff numbers) | pass: 24/26, 68%, 328/480, topics 92/81/58/44/63, Q14 7/24 with 14 × `[2, 4, 6]`, retest 13 takers, 10/52 = 19% → 44/65 = 68%, per question 13/9/5/6/11 |
| `staff.e2e-spec.ts` | pass: cookie flags; 401 without/forged/learner cookie/other secret; 403 for coordinator and admin; 403 on another teacher's group; 404 unknown group, group without records, student outside the roster; staff cookie never opens `/me` |
| Live API (real DB) | `/teach/groups/B-12` returns the same numbers as the spec |
| Playwright (Edge, production build :3001) | 6 passed: language/theme ×2, learner journey ×2, teacher dashboard → insights → Amina 13/20 and 4/5, coordinator refused (UI denied state and API 403) |
| Browser | 1440 dark: dashboard and insights match TDashboard/TInsights numbers (attention list = the handoff's 7 students). 390: no horizontal scroll on `/teach`, `/teach/insights`, `/app/progress` |

Not run: `visual-qa` skill, light theme on `/teach`, keyboard pass, `/code-review`, `/security-review`. `pnpm format:check` still fails on files that predate this work.

## Known limitations and follow-ups

- Teacher screens not built: Classes detail, Materials, Assessments, Builder, Question bank, Analytics (separate), Resources, Settings.
- Center workspace (phase 5) is next: aggregate-only endpoints using the same staff session.
- Group dates show as stored (Oct 6 / Oct 13, 2026); there is no "today = Oct 14" simulation.
