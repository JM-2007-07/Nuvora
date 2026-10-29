# Full site pass: accounts, every page wired, motion and hover (2026-10-28/29)

Branch `feat/faroz-rebrand` · Status: **implemented and verified** · Follows [defense readiness](2026-10-28-defense-readiness.md).

## Context

The owner tried the site and found: buttons did not lead to the learner, teacher or center areas; almost no animation or hover; no page transitions; no login, registration or subscription; no real photos; missing pages. They asked for a full audit and fixes, all requests through the real backend, and more subagents.

## Decisions (owner, in the chat, 2026-10-28)

- Prisma migration for accounts: **approved** (schema shown first). Payments: **demo checkout** (plan recorded, nothing charged; the design has no prices). Photos: **Unsplash** (Pinterest images have no license for the site); 3 photos approved one by one and downloaded with credits (`apps/web/public/photos/CREDITS.md`). `remark-gfm 4.0.1` install approved.

## How the work was split (subagents)

1. Audit: `quality-reviewer` (code) and `visual-reviewer` (browser) in parallel.
2. Wave 1: `implementer` built the motion/hover system; the coordinator applied the migration and built the API.
3. Wave 2: three `implementer`s in parallel with disjoint files and their own message parts (`messages/parts/{site,learn,work}`): public site + auth, learner app, teacher + center.
4. Wave 3: `quality-reviewer` and `visual-reviewer` again; the coordinator fixed every P0/P1 they found.

## Changes

- **API (NestJS):** migration `20261028200000_accounts_plans_groups` (accounts, organizations, subscriptions, study groups, members; additive, checksum pinned). `/auth/register|login|logout|me` (scrypt, no e-mail enumeration on login, one identity per browser), `/plans`, teacher/center groups with join codes, learner join under a row lock, `/library`, `/me/stats` (XP, level, streak, badges from stored activity), account staff in the staff guard, demo groups hidden from account admins, unique-violation races mapped to 409/retry, structured staff activity dates, localized topic names for reference figures.
- **Web:** motion/hover system (button/card/row hovers with glow, route fade, scroll reveal with Motion, animated bars and ring, delayed skeletons, reduced motion), `/start`, `/login`, `/signup` (demo checkout), `/library`, `/privacy`, `/terms`, account-aware header (Sign in / "My workspace"), every homepage/footer CTA wired, licensed photos; learner app: focused quest layout, skill tree, quests, lessons/topics inside the app (old URLs redirect), stats and badges, join by code; teacher: classes (create group, join code), class detail, students, analytics, settings; center: analytics, students (participation only), account groups. Single-column page grids use `minmax(0,1fr)` so nothing widens the page at 390 px.

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, web `build` | pass |
| `pnpm test` | api 146 unit + 75 e2e, web 3 |
| Live API (real DB) | register teacher → plan → group `JS-…`; register learner → join; teacher sees member; wrong password 401; duplicate e-mail 409; Amina stats 170 XP, 2 badges |
| Playwright (Edge, production build) | 10 passed: language/theme ×2, learner journey ×2, teacher ×2, center ×2, accounts journey (signup → group → join → member visible), login error |
| Browser | 390 px: no horizontal scroll on /app/progress, /privacy, teacher and center pages; signed-in header shows "My workspace" |

Not run: Lighthouse, a full keyboard pass on every page, native-speaker review of ru/tg, `/code-review` and `/security-review` built-ins (the quality-reviewer covered security; no blockers).

## Known limitations

- Playwright's accounts journey and the reviewers created test accounts and groups in the local DB (e-mails `*@demo.tj`); `db:seed:demo` does not remove accounts.
- No rate limiting on login/register/join (local demo; must not be deployed publicly). No `secure` cookie flag (http on localhost).
- Account teachers see each member's diagnostic score, not answer by answer (demo B-12 has answer-by-answer).
- B-14/C-02/A-05 figures stay reference/synthetic and are labelled. Assessment builder, question bank, materials, invitations and editable permissions are still not built.
