# Defense readiness: PWA, QA pass, real vs prototype (Faroz phases 6–7)

Date: 2026-10-28 · Branch: `feat/faroz-rebrand` · Status: **PWA implemented and verified; release QA partly run** · Defense: Mon 2 Nov 2026.

## Changes

- `apps/web/src/app/manifest.ts`: web app manifest at `/manifest.webmanifest` (name Faroz, dark `--bg` colours, the brand's 192/512 icons from `assets/brand/faroz`). Next.js adds `<link rel="manifest">` to every page. **No service worker**, on purpose: nothing private (learner, teacher or center data) is cached offline.

## QA pass (this session)

| Area | Checked | Result |
| --- | --- | --- |
| Automated | `pnpm lint`, `typecheck`, `test`, `build`, `seed:check` | pass (api 137 unit, 66 e2e; web 3) |
| Browser e2e | Playwright, 8 tests on the production build | pass: language/theme, learner journey, attempt isolation, teacher journey, coordinator denied on /teach, center admin journey with response privacy check, coordinator/teacher denied on /center |
| PWA | `/manifest.webmanifest`, link tag on `/ru/app`, icon 200 image/png | pass |
| Layout 390 px | `/app`, `/app/progress`, `/teach`, `/teach/insights`, `/center`, `/center/groups` | no horizontal scroll |
| Themes | dark everywhere; light on `/tg/app`, `/en/teach` | readable; HUD card fixed for light earlier |
| Languages | ru, en, tg on `/app`; ru/en/tg on `/center` | texts present; Tajik headings use Inter |
| Keyboard | `/en/teach`: skip link, visible focus ring (2.4 px), staff chooser by Tab + Enter | pass |
| Security (self-review) | state-changing endpoints: learner session, staff session, attempt submit, lesson completion; cookies httpOnly + SameSite=Lax; CORS only `WEB_ORIGIN`; staff and learner cookies cannot be swapped; roles and group ownership on the server; center responses aggregate-only | no issue found |

Not run: built-in `/code-review` and `/security-review` (recommended once before merging), `visual-qa` skill across every page, Lighthouse, reduced-motion pass on the new pages, a native-speaker review of ru/tg texts.

## Real vs prototype (say this at the defense)

**Real (stored in PostgreSQL, computed on the NestJS server):**
- Content: JavaScript subject, 5 topics, lessons, real resources, 25 practice/retest questions, the 20-question diagnostic (and the older Python subject).
- Learner: demo or guest session, diagnostic and retests scored on the server, answers stored, results re-opened from storage, before/after per topic, recommendations.
- Group B-12: 26 demo learners whose handoff answers were replayed through the same scoring code; every teacher and center number for B-12 is computed from those stored answers.
- Teacher: group analytics, gap insights, a student answer by answer; only for the teacher's own groups.
- Center: group totals, participation, flags; never individual scores or answers.
- Access: signed httpOnly sessions; roles and ownership enforced by the server (401/403 tested).

**Prototype or reference (labelled in the UI):**
- B-14 figures are reference values from the design; C-02 and A-05 are synthetic, as in the design.
- Demo staff and groups are defined in code (no migration, owner decision); no passwords; must not be deployed publicly.
- Not built: XP/levels/streaks/badges, library, skill tree, assessment builder, question bank, materials, assigning practice, invitations, group creation, editing permissions, oversight. Settings are read-only.
- ru and tg texts are AI drafts awaiting native review.

## Defense-day checklist

- [ ] `pnpm db:seed:demo` the evening before (resets demo learners and B-12, removes guests). Needs the owner's go-ahead each time.
- [ ] Start the API (`api` in `.claude/launch.json`) and check `http://localhost:4000/api/v1/health`.
- [ ] Use a production build (`pnpm build`, then `web-prod`) for the demo, not `next dev`.
- [ ] Learner live run as a **guest** (Amina already has the finished before/after).
- [ ] Teacher: Dilshod Karimov → B-12 → Gap insights → Amina.
- [ ] Center: Farhod Jalilov → Groups → B-12; then Komila Rasulova on Settings to show the server refusal.
- [ ] Backup: screenshots or a recording in case the laptop fails.
