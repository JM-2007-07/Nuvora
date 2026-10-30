# 2026-10-29: Center group wizard

Status: **implemented and verified** (real database read-only, browser on a production build up to the confirmation dialog). Creating a group in the real database: **not run** (owner asked to keep the demo data unchanged).
Gate: G4 (Faroz phase F5)   Design: handoff CGroupCreate (§4, §5 flow 3)   Decisions: D-23

## Context

The handoff's center flow starts with "create group → pick teacher → add students". The center could only create a bare group (name, seats, schedule) for account admins; the code-defined demo center had no database organization, so Farhod could not create anything.

## Decisions (owner, in the chat, 2026-10-29)

- **Migration** `20261029220000_center_group_wizard`: five nullable columns on `study_groups` (`displayCode`, `startsOn`, `languages`, `teacherKey`, `teacherName`) and two indexes. SQL shown before applying; applied with approval; SHA-256 pinned.
- The demo center gets an `organizations` row (`demo-center`) and the design's four unassigned students as demo learners.
- **No demo reset** (owner: the demo data is still needed). A new additive command `pnpm db:seed:center` creates only what is missing; it was run with approval and created the organization row and the four students.
- **No test group** in the real database: the browser check stops at the confirmation dialog.

## Changes

- **Shared** `packages/shared/src/group-wizard-api.ts` (options, request with code/seat/language rules); `StudyGroupView` gains `displayCode`, `startsOn`, `languages`.
- **API** `apps/api/src/groups/group-wizard.{service,controller}.ts`: `GET /center/group-wizard`, `POST /center/groups` (admin, or coordinator with `coordGroups`; code unique in the center, teacher from the center, students unassigned, seats, one transaction). `GroupsService`: teachers see groups assigned by key (so demo teacher Dilshod sees wizard groups in `/teach/my-groups`), center lists use the demo center organization, participation-only detail by code. `CenterService` lists wizard groups first; a group that has not started is "upcoming" and gets no participation flag.
- **Demo:** `seed/demo/prepare-center.ts` (`db:seed:center`), and `db:seed:demo` step 6 (organization row, wizard groups removed, students reset).
- **Web** `features/center/group-wizard.tsx` (+ hooks), route `/[locale]/center/groups/new`; "Create group" on the center dashboard and groups page opens it (also for account admins, replacing the old dialog); the teacher's group card shows the code. Messages `GroupWizard` in tg/ru/en (ru/tg AI drafts).

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | pass |
| `pnpm test` | api 171 unit (incl. migration pin) + 96 e2e (5 new wizard tests: options, create and visibility for center and teacher, refusals, permissions, missing organization), web i18n parity 3. One earlier e2e run reported 93/96 without a failure; two reruns passed 96/96 |
| `pnpm --filter @nuvora/web build` | pass |
| `pnpm db:migrate`, `db:status` | applied; up to date |
| `pnpm db:seed:center` | created the organization row and the 4 students; nothing else changed |
| Live API (read-only) | wizard options: 2 subjects, Dilshod available, 2 reference teachers unavailable, 4 students, taken codes A-05…C-02 |
| Browser (prod build, ru, 1440 px) | empty-step validation, teacher list, student selection with seat count, review checklist, confirmation dialog, Cancel; no group created (checked through the API afterwards) |

Not run: creating a group in the real database and the teacher-side view of it (covered by the HTTP tests only), a Playwright scenario (it would leave a group in the demo), light theme and 390 px for the wizard, a native-speaker review of the new texts.

## Known limitations and follow-ups

- Test accounts from earlier invitation checks ("Bahrom Saidov", two "E2E Invitee") appear as teachers in the wizard and on Staff; removing them needs the owner's decision.
- Editing a group (teacher, archive, moving students) and assigning reference teachers are not built.
