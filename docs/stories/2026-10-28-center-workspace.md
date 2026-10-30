# Center workspace (Faroz phase 5)

Date: 2026-10-28 · Branch: `feat/faroz-rebrand` · Status: **core implemented and verified** · Follows [teacher workspace](2026-10-28-teacher-workspace.md).

## Context

Handoff flow 3 (center) and the privacy and permission rules of §7: centers see group totals and participation only, never individual scores or answers, and never who got targeted practice or a retest. Same no-migration decision as the teacher workspace.

## Decisions

- **Aggregates only, by construction.** `CenterService` reduces the teacher analytics to a `GroupAggregate` (students, submitted, answers correct/total, topic percents) before anything else happens; the pure `toCenterGroup()` accepts nothing per student. The strict `CenterGroupSchema` has no per-student field. Group detail adds participation as name + took the diagnostic yes/no.
- **Roles on the server.** `/center/*` is `@Roles('ADMIN', 'COORDINATOR')`; `/center/settings` is admin-only. Coordinator permissions (handoff `permissionDefaults`) are checked per handler. A teacher gets 403 on every center endpoint.
- **Honest sources.** B-12 is computed from stored answers ("recorded"); B-14 uses the handoff's reference figures; C-02 and A-05 are labelled synthetic as in the handoff. The stat that was "active students 82" in the design is shown as **enrollments in active groups (86)**, which is what can be computed without a student table.
- **Not built (needs storage):** create group wizard, invitations and the invite page, moving students, editing permissions, oversight, center analytics page. Settings are read-only and say so.

## Changes

- Shared: center schemas in `packages/shared/src/staff-api.ts`.
- API: `apps/api/src/center/` (view mapper + spec, service, controller, module); `TeachingService.analyse()` exported for reuse; demo org gained capacities, reference answer totals, the staff directory and permission defaults.
- Web: `/center` (stats, topic totals per group with source labels, groups needing attention with flags), `/center/groups`, `/center/groups/[code]`, `/center/staff`, `/center/settings`; shared shell and denied state; `Center` messages in en/ru/tg (ru and tg need native review).

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | pass |
| `pnpm test` | pass: api 137 unit, 66 e2e; web 3 |
| `center-view.spec.ts` | B-12 92% participation, 68% diagnostic, both flags; B-14 70%, C-02 75% (handoff CGroups); B-16 setup incomplete; views have exactly the schema's keys |
| `staff.e2e-spec.ts` (center part) | 401 without session; teacher 403 on all center endpoints; coordinator 403 on settings, 200 on staff; admin 200 on settings; 404/400 for bad groups |
| Playwright (Edge, production build) | 8 passed incl. admin journey with a check that `/center/groups/B-12` contains no score, retest, answers or isCorrect, and coordinator/teacher denials |
| Browser | `/ru/center` at 1440 dark; `/tg/center` and `/tg/center/groups` at 390: no horizontal scroll |

Not run: `visual-qa`, light theme on `/center`, keyboard pass, `/code-review`, `/security-review`.
