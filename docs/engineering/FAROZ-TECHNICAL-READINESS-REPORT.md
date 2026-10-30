# Faroz technical readiness report (Phase 0 audit)

Date: 2026-10-30. Branch `docs/site-copy` (on top of `feat/faroz-rebrand`, last commit `bffc117`). Scope: audit only, against the owner's "FAROZ — MASTER ENGINEERING DIRECTIVE". No application code, schema, database, packages or `.env*` files were changed. The untracked `faroz-handoff/` folder was not touched.

**How to read the evidence column**

- **V** = verified in this audit (command output, code read, or a live request/page on the production build at :3001 against the running API at :4000).
- **S** = taken from a dated story in `docs/stories/` and not re-checked here.
- Severity: **Critical / High / Medium / Low**. Where it matters, each finding says whether it is **acceptable for the local defense demo** (AGENTS.md: the MVP runs on the team laptop and must never be deployed publicly) or **blocks production**.

---

## 1. Executive summary

Faroz is a working full-stack MVP, not a mock-up. The core learning loop (diagnostic → per-topic scores → recommendations → practice/retest → before/after) runs through the real NestJS API and PostgreSQL. Scoring happens on the server and correct answers are never sent before submission (V: live request and a dedicated e2e test). The teacher workspace shows a group answer by answer, the center workspace shows only group totals and participation, and the server enforces those roles (V: teacher → `/center/overview` 403, center → `/comms` 403). Chats, voice messages and WebRTC calls, profiles, accounts, invitations and a group wizard exist and are covered by API tests.

All four quality checks pass today (V): `pnpm lint`, `pnpm typecheck`, `pnpm test` (api 192 unit + 116 e2e, web 3), `pnpm build`.

What it is **not yet**:

1. **Not production-safe.** By design there are password-less demo logins for every role, including the center admin; no rate limiting; stateless sessions that cannot be revoked; no `secure` cookie; no CSRF token; no security headers; no audit log. Fine for the defense on a laptop, blocking for any public deployment.
2. **Not ready for a mobile client.** Only the chat module accepts a bearer token; every other guard reads cookies, there is no endpoint that issues a token, and tokens never expire. This is the main thing to fix before `apps/mobile`.
3. **Identity and organizations are split three ways:** demo staff and the demo center live in code (`staff/demo-org.ts`), password accounts in `accounts`, learners in `users`. Ownership is stored as strings (`staff:…`, `acct:…`, `org:…`, group codes) without foreign keys. This is the biggest structural debt and it blocks Super Admin, proper RBAC and organization isolation.
4. **Directive features that do not exist yet:** Super Admin, standard exam mode with live monitoring and violations, learners taking teacher assessments, push notifications and notification preferences, offline sync, audit logs, Google/Apple sign-in, PIN/biometrics, password reset and email verification, content management UI.
5. **Demo data has drifted** (V): Amina's dashboard says "no gaps now" because of extra practice attempts from earlier checks, the demo chats contain test messages, and the center lists test teacher accounts. Resetting needs the owner's approval (`db:seed:demo`).

## 2. Actual repository architecture

| Area | Fact (V) |
| --- | --- |
| Monorepo | pnpm 12.15.0 workspace: `apps/api`, `apps/web`, `packages/shared`. Node ≥ 24. TypeScript 6.0.3 forced by `overrides` |
| Web | Next.js 16.4.3, React 19.3.0, next-intl 4.14.9, next-themes 0.4.6, TanStack Query 5.104.5, Motion 14.6.0, Tailwind 4 + shadcn 4.22.1 (`radix-vega`), lucide icons, react-markdown 10.1.0 + remark-gfm, socket.io-client 4.8.4. Browser calls go to `/api/v1/*` on the web origin and are rewritten to the API (`next.config.ts`), so the cookie is first-party |
| API | NestJS 12 (ESM), Prisma 7.10.1 with `@prisma/adapter-pg`, Zod 4.6.7, Socket.IO 4.8.4 (`@nestjs/websockets` 12.2.0). 15 feature modules: identity, accounts, staff, catalog, lessons, quizzes, progress, recommendations (pure), teaching, center, groups, assessments, invitations, comms, profiles, health |
| Shared | `packages/shared`: Zod schemas and types for content, learning, staff, accounts, assessments, invitations, group wizard, comms, profiles; compiled with `tsc` to ESM. Used by both apps |
| Database | PostgreSQL, 30+ models in `apps/api/prisma/schema.prisma` (720 lines), 10 forward-only migrations (2026-10-25 … 2026-10-30), checksums pinned in `migrations-integrity.spec.ts` |
| Content | Seed content as code (`apps/api/src/seed/content/`): subjects `javascript` (5 topics, 20-question diagnostic) and `informatics`; loader with dry-run; checker with broken fixtures |
| Tests | api: Vitest unit (`*.spec.ts`, 192) and HTTP/socket e2e (`test/*.e2e-spec.ts`, 116) with **in-memory Prisma fakes**; web: `node --test` i18n key parity (3); Playwright (Edge) 7 spec files |
| Process | `AGENTS.md`, `CLAUDE.md`, `docs/` with one authoritative document per topic, 6 ADRs, decisions D-01…D-25, 21 stories; skills `verify`, `visual-qa`, `design-review`, `new-story`, `add-lesson-content`, `humanizer`, `ui-ux-pro-max`; subagents `architect`, `implementer`, `quality-reviewer`, `visual-reviewer`; `.claude/settings.json` deny/ask rules |
| Routes (web) | Public `/`, `/start`, `/login`, `/signup`, `/library`, `/privacy`, `/terms`, `/invite/[token]`, `/u/[ref]`, `/status`; learner `/app/*` (dashboard, quests, quest player in a focus layout, results, skills, progress, topics, lessons, messages, profile); teacher `/teach/*` (dashboard, classes, students, insights, analytics, assessments + builder, messages, profile, settings); center `/center/*` (dashboard, analytics, groups + wizard, staff, students, settings, profile). Old Nuvora URLs (`/lessons`, `/quizzes`, `/subjects`, `/topics`, `/progress`) redirect into `/app` |

Git state (V): branch `docs/site-copy`, clean except untracked `faroz-handoff/`. `docs/site-copy` is two commits ahead of `feat/faroz-rebrand` and is not pushed.

## 3. Existing functionality matrix

Statuses: **Complete and verified** · **Needs improvement** (implemented, works, has a real gap) · **Partial** · **UI only / mocked** · **Missing** · **Blocked**.

| Feature | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Homepage, public pages (ru/tg/en) | Complete and verified | V: 200 on all, hero renders, no console errors | Orbit hero, privacy, terms, library |
| Subject catalog / subject and topic pages | Needs improvement | V: `/subjects/*` redirects to `/app/skills` | No public catalog page; the subject is reached only inside the learner app |
| Lessons | Complete and verified | S (full-site pass); V route builds | Markdown without raw HTML |
| Diagnostic and topic quizzes | Complete and verified | V: quiz payload has no `isCorrect`/explanations; scoring in `quizzes/scoring.ts`; e2e `leakAnswers` test | Drafts kept in `sessionStorage` of the tab only |
| Results and recommendations | Complete and verified | V: `/app/results` lists stored attempts; rule-based `recommend.ts` (unit-tested) | |
| Knowledge map (skill tree) | Complete and verified | V: 5 topic nodes with scores | |
| Learning journey (before/after, progress) | Complete and verified | V: `/app/progress` (tests 5, goals 4/5, XP 210, before/after) | |
| Reading library | Complete and verified | V: `/library` 200, no overflow at 390 px | |
| Learner dashboard | Needs improvement | V: shows "no gaps now" for Amina | Correct for the stored data; the **demo data drifted** (see F-01) |
| Guest mode, demo profiles | Complete and verified | V: `POST /session` | Intentional, no passwords (ADR-0006) |
| Email/password accounts | Needs improvement | V: scrypt, Zod; S: e2e | No password reset, no email verification, anyone may register as teacher or center |
| Teacher dashboard, insights, student answers | Complete and verified (demo group B-12) | V: live numbers from stored answers | |
| Teacher analytics for any group | Partial | V: `MAIN_GROUP = 'B-12'` in `teacher-dashboard.tsx:16`, used by `analytics.tsx` | Account teachers' own groups get no answer-by-answer analytics |
| Teacher assessments (list, builder, publish) | Partial | S + code | **Learners cannot take them**: no attempt table, no learner view |
| Question bank page, materials, assign practice | Missing | S (assessment story) | |
| Center dashboard, groups, students (participation), staff | Complete and verified | V: live at 1440 and 390 px, tg/en | B-14/C-02/A-05 figures are **design reference/synthetic values**, labelled in the UI |
| Center group wizard | Needs improvement | S: creating a group in the real DB never run in the browser | |
| Teacher invitations, editable permissions | Needs improvement | S + V settings page | `teachCreate`/`teachShare` are stored but unused (labelled) |
| Chats, voice messages, calls (D-24) | Complete and verified (local) | S: live two-window checks; V: center gets 403 | Mesh calls ~5–6 people; calls live in API memory; no TURN by default |
| In-app notifications (toast, system notification) | Needs improvement | S | Only while a tab is open; no push, no stored preferences |
| Profiles (D-25) | Complete and verified | S live check + e2e | |
| Theme (dark default, light, persisted) | Complete and verified | V: `data-theme` persisted | "System" option dropped by D-23; the directive asks for it |
| Localization ru/tg/en | Needs improvement | V parity test; S | ru/tg are AI drafts; native review is still open (release requirement) |
| Loading / empty / error states | Needs improvement | V: `loading.tsx` per area, `ErrorState`/`EmptyState` components | **No `error.tsx` boundary anywhere** (F-08) |
| Settings | Partial | V: teacher settings shows account and logout only | No notification settings, no password change |
| Super Admin workspace | Missing | V: no role, no route | |
| Standard exam mode, live monitoring, violations | Missing | V: no exam session/event tables | |
| Push notifications, device tokens | Missing | V | |
| Offline learning and sync | Missing | V | |
| Audit log | Missing | V: no table, no request logging | |
| Google / Apple sign-in, PIN, biometrics | Missing | V | |
| Content management UI (subjects, topics, lessons) | Missing | V: content is seed code | Intentional for MVP (ADR-0005) |
| PWA | Partial | V: `app/manifest.ts`, icons; no service worker | Installable metadata only, no offline |
| Mobile app | Missing | V: no `apps/mobile` | |
| Playwright smoke in this audit | Blocked | Its journeys create accounts, attempts and invitations, i.e. write to the DB, which the owner did not allow for this audit | Last green run: S (14 passed, 2026-10-29) |

## 4. Frontend audit

**What works (V).** All routes build (static where possible). Every page probed returned 200; unknown paths 404. Learner, teacher and center pages render real API data. No horizontal scroll at 390 px on `/app`, `/app/progress`, `/app/quests`, `/library`, `/tg/app/messages`, `/tg/center/groups`, `/en/center/students`, `/ru/center/settings`, the quest player. The quest player has no chat dock (no distraction during tests). Consoles were clean apart from errors caused by this audit's own permission probes.

| ID | Finding | Evidence | Why it matters | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F-01 | Demo data drifted from the handoff state | V: Amina has extra "Functions practice" attempts (29.10 0/5, 0/5; 30.10 4/5), so her dashboard shows "no gaps"; chats contain test text ("Во время теста 455"); center shows 6 teachers and 2 pending invitations from test runs | The defense story ("Amina 13/20, Arrays gap") does not appear as rehearsed | **High for the defense** | With owner approval: `pnpm db:seed:demo` the evening before; decide about test accounts `*@demo.tj` |
| F-02 | Teacher analytics is hard-wired to group B-12 | V: `apps/web/src/features/teach/teacher-dashboard.tsx:16`, `analytics.tsx` | A real teacher account sees no question-level analytics for their own groups | Medium | Pick the group from the teacher's list; API already has `/teach/groups/:code` |
| F-03 | Learners cannot take teacher assessments | S + code: no learner endpoint or attempt table | The teacher flow ends at "published"; "Submitted/Average" stay empty | Medium (product gap) | Part of the exam-mode domain (section 14) |
| F-04 | No public subject catalog | V: `/subjects/[slug]` redirects to `/app/skills` | The directive lists a public catalog | Low | Add when content grows beyond one subject |
| F-05 | Quiz drafts live only in `sessionStorage` | V: player text "answers are kept in this tab" | A closed tab or a second device loses answers; not acceptable for official exams | Low for practice, High for exams | Server-side exam sessions with autosave |
| F-06 | Notifications only while a tab is open | S: `notifications.ts` | No reminders, no mobile alerts | Medium | Notification table + Web Push / Expo push (section 14) |
| F-07 | Settings are thin | V: name, role, logout | No password change, notification preferences, language default | Low | Grow with accounts work |
| F-08 | No route error boundaries | V: no `error.tsx` under `src/app` | An unexpected render error shows Next's default page instead of a Faroz error state with retry | Medium | Add `error.tsx` (client) per area using `ErrorState` |
| F-09 | `/status` (G1 walking skeleton) is still public | V | Shows DB version to anyone; leftover | Low | Remove or restrict |
| F-10 | Pages render in a hidden browser pane only after it becomes visible | V: loaders stayed until the pane was shown | Not a product bug (background-tab throttling of Motion/route transitions), but it affects automated checks | Info | Keep verifying with a visible window |

## 5. Backend audit

**What works (V).** Every controller validates input with `ZodValidationPipe` and strict schemas from `packages/shared`. One error shape via `ApiExceptionFilter` (500s carry no internals). Guards resolve identity from the signed cookie only (`LearnerGuard`, `StaffGuard` + `@Roles`, `CommsGuard`, `ProfileGuard`). Pure logic (scoring, mastery, recommendations, stats, center view, assessment and invitation rules, profile rules) has no Nest/Prisma imports and is unit-tested. Attempts are recorded, scored and turned into mastery and recommendations in one transaction.

Endpoint inventory (V): about 70 routes. Every staff route has a guard and a role list; `center/*` allows ADMIN and COORDINATOR, `PUT settings/permissions` and invitations are ADMIN-only, `teach/*` is TEACHER-only, `me/*` uses the learner session. I found no unguarded write endpoint other than the intentional demo logins and registration.

| ID | Finding | Evidence | Why it matters | Severity | Recommendation |
| --- | --- | --- | --- | --- | --- |
| B-01 | Three identity models | V: `users` (learners incl. demo/guest), `accounts` (password accounts; learners link to a `User`), demo staff in code (`staff/demo-org.ts`); three cookie value shapes (`<userId>`, `staff:<slug>`, `staff:acct:<id>`) | Every new feature (Super Admin, memberships, exam roles, mobile) must handle three cases; RBAC rules are duplicated in guards | **High (tech debt, blocks Super Admin)** | One `User` + `Membership(organizationId, role)`; demo staff and the demo center seeded into the DB |
| B-02 | Ownership stored as strings without foreign keys | V: `Assessment.ownerKey`, `groupCode`; `StaffInvitation.orgKey`; `Conversation.key`, `ConversationMember.participantKey`; `Profile.participantKey`; `StudyGroup.teacherKey` | No referential integrity, no cascade, isolation depends on every query building the key correctly | High (production) | Replace with FKs during B-01 |
| B-03 | Bearer token accepted only by comms | V: `Authorization: Bearer` read only in `comms.controller.ts:50` and the socket handshake; no endpoint returns a token | A mobile app cannot call `/me/*`, `/teach/*`, `/center/*` | **High (blocks mobile)** | One auth guard that accepts cookie (web) or bearer (mobile); token issue/refresh endpoints |
| B-04 | Sessions cannot expire or be revoked on the server | V: `identity/session-cookie.ts` signs only the id; `maxAge` is a browser hint; logout only clears the cookie | A copied cookie or mobile token works until `SESSION_SECRET` changes; no "sign out everywhere" | High (production) | `sessions` table (hashed opaque token, expiry, device, revokedAt) |
| B-05 | Missing `SESSION_SECRET` falls back to a random per-process key | V: `SessionSigner` constructor | Every API restart signs everyone out (S: known); two API instances could not share sessions | Medium | Make it required outside tests; owner sets it in `apps/api/.env` |
| B-06 | Demo and reference figures in code | V: `demo-org.ts` holds B-14/C-02/A-05 reference values | Clearly labelled in the UI, but they are not data and cannot be managed | Low for demo | Move to seed data or drop after the defense |
| B-07 | No audit log, no request logging | V: the only logs are the bootstrap line and 500s in the filter | Directive requires logging sensitive admin actions; incident analysis impossible | Medium (production) | Append-only `audit_events` + structured request log without secrets |
| B-08 | Unvalidated env variable | V: `COMMS_ICE_SERVERS` parsed with `JSON.parse` in `comms.service.ts:81`, outside the Zod `EnvSchema` | Malformed value throws at runtime; breaks the "validate env with Zod" rule | Low | Add to `config/env.ts` |
| B-09 | Live call state in memory | S/V: `calls-registry.ts` | API restart ends calls; no horizontal scaling | Low for MVP | Acceptable until an SFU (LiveKit, D-24) |
| B-10 | Binary files in PostgreSQL | V: `VoiceClip.data`, `ProfileAvatar.data` are `Bytes` | Fine at MVP size; grows the DB and backups | Low | Object storage later |
| B-11 | Unused stored permissions | S/V: `teachCreate`, `teachShare` | UI says so honestly | Low | Wire into the assessment and sharing rules |

## 6. Database audit

**Good (V).** Content tables have unique slugs and composite uniques (`[quizId, key]`, `[questionId, key]`, `[topicId, key]`). Learner history is protected: history → content FKs use `ON DELETE RESTRICT` (D-21). Attempts have `[attemptId, questionId]` unique, mastery `[userId, topicId]`, lesson progress `[userId, lessonId]`. Useful indexes exist on hot paths (`[userId, submittedAt]`, `[conversationId, createdAt]`, organization and teacher indexes). Migrations are forward-only and checksum-pinned. `StudyGroup` has `[organizationId, displayCode]` unique; invitation tokens are stored as SHA-256 only.

| ID | Finding | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| D-01 | Polymorphic string keys instead of FKs | see B-02 | High (production) | Normalise during identity consolidation |
| D-02 | Organization isolation is partial | V: `accounts.organizationId`, `study_groups.organizationId` are real FKs; assessments, invitations, permissions, conversations and profiles are scoped by string keys; the demo center exists both in code and as an `organizations` row | High (production) | Every org-owned table gets `organizationId` FK; queries scoped by membership |
| D-03 | No tables for exam sessions, exam events, notifications, preferences, device tokens, sessions, audit | V | — (missing capability) | New additive migrations, each owner-approved |
| D-04 | Teacher assessment attempts do not exist | V | Medium | Part of exam domain |
| D-05 | Test data in the local DB | S/V: `*@demo.tj` accounts, extra attempts and messages | Medium for the defense | Owner decides: reset and/or delete |

The schema was read only; no migration status command was run that writes anything (`db:status` reads, but was not needed).

## 7. Design and UX audit

**Preserve.** The Faroz identity is consistent: tokens from `faroz-tokens.css`, Unbounded + Inter (Inter for Tajik headings because Unbounded lacks ҳ ҷ ӣ ғ қ ӯ), the orbit hero, HUD cards, the motion system with reduced-motion paths, the focus layout for tests, route loaders. Copy follows `VOICE.md`. Reference/synthetic numbers are honestly labelled ("из макета", "синтетические").

| ID | Finding | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| U-01 | System theme option is missing | V: D-23 dropped "system"; directive asks for dark/light/system | Low | Owner decision; next-themes supports it cheaply |
| U-02 | Not measured: Lighthouse, axe, full keyboard pass, screen reader | S: listed as not run in several stories | Medium | Run before calling the web "excellent" |
| U-03 | Screenshots at 1440/390 were not captured in this audit | V: the app window was not visible, screenshots timed out; layout was checked by text and `scrollWidth` instead | Info | Visual comparison with handoff screenshots stays with `visual-qa` |
| U-04 | Thin settings and no notification center | see F-06, F-07 | Low | |
| U-05 | Native-speaker review of ru/tg | S/AGENTS.md | High for release | Owner arranges reviewers |

No redesign is recommended. Improvements should be targeted (error boundaries, settings, analytics picker), not a new visual direction.

## 8. Security findings

| ID | Finding | Evidence | Demo | Production | Recommendation |
| --- | --- | --- | --- | --- | --- |
| S-01 | Password-less demo login for every role | V: `POST /staff/session {"staff":"farhod-jalilov"}` returns a center-admin cookie (`staff.controller.ts`); `POST /session` for demo learners | OK (by design, ADR-0006) | **Critical** | Feature flag that removes demo routes outside demo mode |
| S-02 | No rate limiting anywhere | V: no throttler; `/auth/login`, `/auth/register`, `/session` (each guest call inserts a `users` row), uploads | OK locally | **High** | `@nestjs/throttler` (package approval) or a small in-memory limiter; guest creation capped |
| S-03 | Sessions not revocable, no expiry in the token | B-04 | OK | **High** | Sessions table, short-lived access + refresh for mobile |
| S-04 | Anyone can self-register as teacher or center admin | V: `RegisterRequestSchema` accepts `TEACHER` and `CENTER_ADMIN` | OK | **High** | Email verification; centers created by Super Admin or approved |
| S-05 | Cookies lack `secure`; no CSRF token; no Origin check on writes | V: `cookieOptions = { httpOnly, sameSite: 'lax' }` | OK on http localhost | Medium | `secure` in production, Origin/`Sec-Fetch-Site` check for state-changing requests |
| S-06 | No security headers (CSP, `nosniff`, frame-ancestors) | V: no helmet or manual headers in `app.setup.ts` or `next.config.ts` | OK | Medium | Add headers in Next config and API |
| S-07 | Voice uploads trust the client MIME type | V: `comms.service.ts` checks size, duration and a MIME regex, not magic bytes (avatars do check magic bytes) | OK | Low | Magic-byte check like avatars, plus `nosniff` |
| S-08 | Retakes reveal answers and inflate scores/XP | V: unlimited attempts; correct answers in each result; XP = 10 × correct on **every** attempt (`progress/stats.ts`) | OK for practice | Medium (blocks official exams) | Exam mode with attempt limits; XP per first/best attempt |
| S-09 | Center totals for tiny groups reveal individuals | V: `center/center-view.ts` has no minimum group size; a group with one submitter exposes that learner's score | Low (demo groups are large) | Medium (privacy rule) | Hide percentages below a threshold (e.g. fewer than 5 submitted) |
| S-10 | No audit trail of admin actions | B-07 | OK | Medium | Audit table |
| S-11 | Email enumeration on register (`EMAIL_TAKEN`) | V | OK | Low | Generic response + email flow once verification exists |
| S-12 | Socket.IO accepts any localhost origin and no-Origin clients (token required for those) | V: `comms/io-adapter.ts` | OK | Low | Restrict to configured origins in production |

**Verified as safe (V):** scrypt (N=16384) with per-password salt and constant-time compare; strict Zod on every body; correct answers absent from `GET /quizzes/:slug`; server-side scoring only; attempts readable only by their owner (404 otherwise); centers refused on comms (403) and never get learning blocks on profiles (S: e2e); teacher refused on center (403); react-markdown without raw HTML; external links `noopener noreferrer nofollow`; invitation tokens hashed, single-use, expiring; avatars size- and magic-byte-checked; `.env` files are git-ignored and not tracked (only `.env.example`); 500 responses hide internals. No secret values were read or printed in this audit.

## 9. Testing and quality findings

| Check | Result (V, this audit) | Kind |
| --- | --- | --- |
| `pnpm lint` (oxlint type-aware api, ESLint web) | pass | static |
| `pnpm typecheck` (shared, api, web incl. route types) | pass | static |
| `pnpm test` api unit | 21 files, **192 passed** | unit (pure logic, rules, migration checksums) |
| `pnpm test` api e2e | 9 files, **116 passed** | API integration: real Nest app over HTTP and real Socket.IO clients, **Prisma replaced by in-memory fakes** (no PostgreSQL) |
| `pnpm test` web | **3 passed** | i18n key parity only |
| `pnpm build` (shared, api, web) | pass | build |
| Playwright smoke | **not run** (writes to DB; see matrix) | real browser E2E |
| Browser on production build | manual, this audit: learner, teacher, center pages; ru/tg/en; 1440 and 390 px (text and overflow checks); dark and light emulation | manual |
| `seed:check`, `format:check`, Lighthouse | not run | — |

| ID | Finding | Severity | Recommendation |
| --- | --- | --- | --- |
| T-01 | No automated test runs against real PostgreSQL | Medium | A separate test database (owner approval) for repository-level tests of key queries |
| T-02 | Web has no component or hook tests | Medium | Add for the quest player, results and permission-denied states |
| T-03 | Playwright depends on, and writes to, the dev database | Medium | Run it against a disposable test database |
| T-04 | Stories mention flaky e2e runs ("106 passed (116)" without a named failure) | Low | Watch; all runs here passed |

## 10. Technical debt

1. Three identity models and string ownership keys (B-01, B-02, D-01, D-02). **Largest.**
2. Demo organization and reference figures in code (B-06).
3. Stateless sessions (B-04, B-05).
4. Teacher analytics fixed to one group (F-02).
5. Business calculations in web components (for example the median and score bands in `features/teach/analytics.tsx`) that a mobile app would have to duplicate.
6. UI messages only in `apps/web/messages` (not reusable by mobile).
7. Blobs in PostgreSQL (B-10).
8. Internal names `@nuvora/*`, `nuvora_dev` (kept on purpose, D-23).
9. Leftover G1 `/status` page (F-09).
10. Per handover (S): `format:check` fails on ~200 older files because of line endings.

## 11. Missing capabilities (directive vs repository)

Super Admin (role, bootstrap, workspace) · standard exam mode (server timer, autosave, events, violation policy) · live exam dashboard · learners taking teacher assessments · question bank page, materials, assign practice · push notifications, notification preferences, device tokens · offline download and sync queue with idempotent APIs · audit log · Google sign-in, Apple sign-in · PIN and biometrics (mobile) · password reset, email verification, session revocation · content management UI · PWA service worker · user and organization management UI beyond the demo center · Android and iOS apps.

## 12. Dependencies and integration gaps

| Gap | Detail |
| --- | --- |
| Auth for non-browser clients | Only comms reads bearer tokens; no token endpoint (B-03) |
| API base URL for mobile | The web relies on the Next.js rewrite (same origin). A phone must reach the API directly: LAN address or HTTPS; Android blocks clear-text HTTP by default |
| Realtime | Socket.IO already supports a token in the handshake (good for mobile) |
| Calls on mobile | `react-native-webrtc` requires an Expo development build (not Expo Go); TURN needed across networks (`COMMS_ICE_SERVERS`) |
| Push | Needs an external service (Expo push service with FCM/APNs) — owner approval |
| Google/Apple sign-in | External OAuth apps and secrets — owner approval |
| Packages not installed | Throttler, security headers, Expo stack, secure storage, local authentication — each needs approval |
| Unused-by-frontend APIs | None found that are dead; `teachCreate`/`teachShare` values are stored but not enforced |

## 13. Mobile readiness assessment

| Area | Ready? | Why |
| --- | --- | --- |
| Shared contracts | **Yes, mostly** | Zod schemas and types in `packages/shared` (ESM, Zod 4) can be imported by React Native. Needs a verified Metro + pnpm workspace setup (a spike, not assumed) |
| Business rules | Partly | Scoring and mastery are on the server (good). Some view calculations live in web components |
| Authentication | **No** | Cookies only, no token issue/refresh/revoke (B-03, B-04) |
| API reachability | No | Same-origin rewrite only; no HTTPS/LAN setup documented |
| i18n | Partly | Locale ids `ru`/`tg`/`en` are shared; message catalogs live in the web app |
| Realtime | Yes | Socket.IO token handshake exists |
| Offline | No | No sync APIs, no idempotency keys |
| Push | No | Nothing server-side |
| Design tokens | Partly | `tokens.css` is CSS; mobile needs a TS export of the same values |

**Verdict:** start the mobile app only after the auth foundation (tokens, revocation, one guard) and the identity consolidation are done. Otherwise every mobile screen gets built on a model that will change.

## 14. Recommended architecture

Keep the stack (NestJS + Prisma + PostgreSQL, Next.js, shared Zod). Add, in this order:

1. **Auth module** — `sessions` table (opaque random token, stored hashed, `expiresAt`, `revokedAt`, device label). Web keeps an httpOnly cookie that holds the token; mobile gets `{accessToken, refreshToken}` from `/auth/token` and sends `Authorization: Bearer`. **One `AuthGuard`** for both, plus `@Roles`/permission checks. Demo logins stay behind a `DEMO_MODE` flag. *Why:* revocation, expiry and mobile in one design. *Alternative:* JWT access + refresh; trade-off: no instant revocation without a deny-list, more moving parts for a student team.
2. **Identity consolidation** — one `User` (email optional for guests), `Membership(userId, organizationId, role: LEARNER|TEACHER|COORDINATOR|CENTER_ADMIN)`, a separate `platformRole: SUPER_ADMIN` set **only** by a CLI bootstrap command run on the server, never by any HTTP route. Demo staff and the demo center become seed rows. Replace string keys with FKs.
3. **Audit log** — append-only `audit_events(actorId, action, target, orgId, at, meta)`, written by a small service for admin, permission, exam and security actions.
4. **Exam domain** (shared by web and mobile) — `Exam` (from today's `Assessment`), `ExamParticipant` (status, startedAt, deadline computed on the server, lastSyncAt), `ExamAnswer` (upsert with a client mutation id, idempotent), `ExamEvent` (append-only: focus lost, fullscreen exit, background, disconnect, warning, pause, extend, re-admit, submit). Live dashboard over the existing Socket.IO gateway (new namespace). Honest limits: browsers and phones cannot block other apps; events are signals for teacher review, not proof.
5. **Notifications** — `notifications`, `notification_preferences`, `device_tokens`; delivery in-app (socket) + Web Push + Expo push.
6. **Offline** — content packages (lessons, practice quizzes) versioned for download; practice attempts queued on the device with idempotency keys; official exams online-only.
7. **Mobile app** — `apps/mobile`: Expo (development build), Expo Router, TanStack Query, shared Zod contracts, `expo-secure-store` for refresh tokens, `expo-local-authentication` for biometrics, app PIN stored as a salted hash in secure storage, Reanimated for motion, its own component set using exported Faroz tokens. Android first.
8. **Shared packages** — keep `packages/shared` for contracts; add domain constants (roles, permissions), pure view calculations, and move UI message catalogs to a package both apps read (web keeps next-intl).

## 15. Prioritized implementation roadmap

| Phase | Content | Done when |
| --- | --- | --- |
| **0.5 Defense readiness** (until 1 Nov) | Owner-approved `db:seed:demo`; decision on test accounts; `SESSION_SECRET` set by owner; rehearse with the defense checklist; ru/tg review where possible; no new features | Demo runs from a clean state twice |
| **1 Foundation hardening** | Auth module + sessions + single guard (cookie and bearer); rate limits; security headers; Origin check; `error.tsx` boundaries; k-anonymity threshold for center totals; ICE env in Zod; test database for real-DB tests and Playwright | Security findings S-02…S-07, S-09 closed; tests green on a test DB |
| **2 Identity and organizations** | Unified users + memberships; demo org in seed; FKs; Super Admin bootstrap and minimal workspace; audit log | Super Admin actions enforced on server and logged |
| **3 Web completion** | Teacher analytics for any group; learners take assessments; question bank, materials, assign practice; settings (password change, notification prefs); notification center | Directive teacher/center flows end to end |
| **4 Exam mode + live monitoring (web)** | Exam domain, server timer, autosave, events, violation policy, live dashboard | Critical scenarios 7–12 pass in Playwright |
| **5 Mobile preparation** | Shared domain/permissions, message catalogs package, token export, API reachability (HTTPS/LAN), Metro + pnpm spike | A hello-world Expo app reads `/subjects` with a token |
| **6 Android app** | Student flows, then teacher, then center; offline practice; push | Scenarios 1–6 on an emulator and a device |
| **7 iOS + release prep** | Apple sign-in, store metadata, signing, privacy policy | Owner-reviewed builds, nothing published |

## 16. Risks and blockers

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Defense demo shows drifted data | Story does not match | Approved reset the evening before |
| Running `pnpm build`/`test` rebuilds `apps/api/dist` and can stop the dev API watcher (S) | Demo API down | Check `/api/v1/plans` after checks; restart |
| Identity refactor touches every module | Regressions | Do it after the defense, behind tests, in small migrations |
| External services (OAuth, push, TURN, LiveKit) | Cost, secrets, accounts | Owner decisions, one at a time |
| Exam "anti-cheat" expectations | Over-promising | Document platform limits in the UI and docs |
| AI-drafted Tajik/Russian text | Release blocker | Native review |
| Single laptop as server | No real deployment target yet | Decide hosting before mobile beta (phones need HTTPS) |

## 17. Estimated complexity and dependencies

| Task | Size | Depends on |
| --- | --- | --- |
| Demo reset + cleanup | S | owner approval |
| Error boundaries, k-anonymity, ICE env, `/status` | S | — |
| Rate limits, headers, Origin check | S–M | package decision |
| Auth module (sessions, guard, tokens) | L | — |
| Identity consolidation + FKs + demo org in DB | XL | auth module |
| Super Admin + audit log | M | identity |
| Teacher analytics any group | S | — |
| Learners take assessments | M | (better after) identity |
| Exam mode + live dashboard | XL | assessments-for-learners, auth, audit |
| Notifications (in-app, Web Push, Expo push) | L | auth (device tokens), owner approval for push service |
| Offline sync | L | auth, idempotent APIs |
| Mobile scaffold + student flows | L | auth, API reachability |
| Mobile teacher/center + exam client | XL | exam domain |
| iOS + store prep | M | Android app |

---

*Not verified in this audit:* Playwright smoke (DB writes), real-DB tests, Lighthouse/axe, keyboard and screen-reader passes, Safari/Firefox, physical phones, visual comparison with the handoff screenshots (no screenshots could be captured), `seed:check`, `format:check`. Browser checks this audit used demo logins only (they do not write to the database) and opened pages without submitting forms.
