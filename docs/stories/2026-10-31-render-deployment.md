# 2026-10-31: Ready to deploy on Render, and an app download page

Status: **deployed on Render and verified live on 2026-10-31** (https://faroz-web.onrender.com, https://faroz-api.onrender.com). Not verified: an EAS build of the APK, the mobile app on a phone against Render.
Gate: G4 (Faroz)   Decisions: D-31 (Render hosting, proposed), D-30 (push, proposed), D-10

## Context

The owner wants the defense to run from Render and later from a VPS ("MVPS"), and asked for a section on the website to download the mobile app. Until now the project was laptop-only (D-10): demo sign-in for anyone, cookies without `Secure`, no hosting files.

## Decisions

- **Two Render web services and a free PostgreSQL** from one Blueprint (`render.yaml`), region Frankfurt, branch `feat/faroz-platform`, `TZ=Asia/Dushanbe`. Free-plan limits are documented (sleep after ~15 min, database deleted after 30 days).
- **Sockets on two domains:** the site's cookie never reaches the API's `*.onrender.com` host, so the site fetches a two-minute HMAC ticket (`POST /realtime/ticket`, through its own origin) and passes it as `auth.token`; the session store accepts it only while the named session is live. Chosen over cross-site cookies (`SameSite=None`, weaker) and over one combined service (complex proxying).
- **Demo sign-in is a switch** (`DEMO_LOGINS`): on locally, off by default in production, on in `render.yaml` for the defense. Guest mode stays available.
- **Fail fast in production:** no `SESSION_SECRET`, a non-https or localhost `WEB_ORIGIN`, or `RATE_LIMIT=off` stops the server at start.
- **APK hosting by link** (`ANDROID_APK_URL`, read on each request) instead of committing a 50+ MB file; without a link the page says the build is coming.

## Changes

- **API:** `config/env.ts` (`DEMO_LOGINS`, `TRUST_PROXY`, `PORT` fallback, `productionProblems`, `demoLoginsEnabled`); `cookieOptions()` with `Secure` in production for all session cookies (identity, staff, accounts controllers); demo routes answer 403 `DEMO_DISABLED` when off (`POST /session` with a profile, `POST /staff/session`, `POST /auth/token/demo` except guests) and the profile lists are empty; `clientAddress` trusts `X-Forwarded-For` with `TRUST_PROXY=on`; Socket.IO CORS uses the same origin list and no localhost in production; `identity/realtime-ticket.ts`, `POST /realtime/ticket`, tickets in `DbSessionStore.resolve`; `seed/demo/needs-demo.ts`; `scripts/render-start.mjs` (`SEED_ON_START`: off, content, demo, reset-demo) and `start:hosted`.
- **Web:** `lib/realtime.ts` (`apiOrigin`, `realtimeAuth`), used by the exam and comms sockets; new page `/[locale]/download` (hero with a drawn phone, Android button or "coming soon", iOS note, four features, install steps, APK note), links in the header and footer; messages in ru/tg/en (Tajik needs review).
- **Mobile:** `eas.json` (`preview` APK and `production` bundle against the Render API), `android.versionCode` in `app.json`.
- **Shared:** `RealtimeTicketSchema`.
- **Hosting:** `render.yaml`; `.env.example` files for the API and site.
- **Docs:** new [DEPLOYMENT.md](../engineering/DEPLOYMENT.md) (Render steps, every variable, APK flow, checks, free-plan behaviour, rollback, VPS plan), D-31, architecture note on D-10, docs map.

## Verification

| Check | Result |
| --- | --- |
| Unit: `realtime-ticket.spec.ts`, `env-production.spec.ts`, socket origins | pass |
| `pnpm --filter @nuvora/api test:int` (new: a ticket opens the teacher's live board; a learner's ticket cannot; a forged one is refused; a ticket of a signed-out session stops working; no ticket without a session) | 48/48 |
| Production start without a secret and with an http site (`node dist/main.js`, no `.env`) | refuses with both problems listed |
| Site production build with a test `ANDROID_APK_URL` + `next start` | `/download` is rendered per request (`ƒ`); the button links to the APK, "Версия 0.1.0" shown |
| Browser (dev server): `/ru/download` at 1440 px dark, 375 px light, `/tg/download` 375 px dark | layout, "coming soon" state, nav and footer links, no console errors |
| Repo-wide lint / typecheck / test / build / test:int / Android bundle | pass / pass / api 247 + 119, web 7, mobile 9 / pass / 48/48 / pass |

## Live deployment (2026-10-31)

Done in the owner's Render account through the built-in browser. The owner's existing workspace already used its one free database (another project), so a separate free workspace **Faroz** was created (owner's choice; no card needed) and the Blueprint deployed from `feat/faroz-platform` at `f9e3196`.

| Check on Render | Result |
| --- | --- |
| Start script log | `prisma migrate deploy` → `learning content (db:seed)` → `demo data check` → `demo data (db:seed:demo, first start)` → `starting the API` |
| `GET /api/v1/health` | `ok`, PostgreSQL 18.6 up |
| Site `/ru`, `/tg/download`, `/ru/download`, `/en` | 200 |
| Demo teacher on the site | dashboard with seeded data (2 groups, 48 learners, 45 diagnostics); `POST /api/v1/realtime/ticket` 200; no console errors |
| Socket to the API domain (`/comms`) | with a ticket: connected; without or with a forged ticket: disconnected by the server |
| Mobile-style bearer flow (demo token → `/me/progress`, `/me/stats`) | 200 |

## Android build on EAS (2026-10-31)

Expo project @asiljms-team/faroz created on expo.dev in the built-in browser and linked (`app.json`: `owner`, `extra.eas.projectId`; `eas.json`: Node 24.15.0, pnpm 12.15.0), GitHub repository connected (base directory `/apps/mobile`). The owner signed in to the EAS CLI and started the first build, which generated the signing key; that build failed in "Bundle JavaScript" because `packages/shared/dist` is not in git (`exports` points to `dist`). Fixed with an `eas-build-post-install` script that builds `@nuvora/shared`; checked locally (the hook rebuilds `dist` from `apps/mobile`, the Android bundle exports). The rebuild from GitHub (`f9434ee`) succeeded in 21 min: `app-release.apk`, 97.9 MB. `ANDROID_APK_URL` and `ANDROID_APP_VERSION=0.1.0` were set on `faroz-web` in the Render dashboard (not in `render.yaml`, since the link changes with every build).

## Known limitations and follow-ups

- Run the first Render deployment and the checks in DEPLOYMENT.md; the start script (migrate → content → demo data) has not run against a database here.
- The APK link expires with the EAS artifact (13 days on the free plan): rebuild or host the APK on a GitHub release.
- The mobile sign-in screen still shows demo rows when the server has demo sign-in off (it then gets 403 and shows an error).
- A QR code on `/download` would help at the defense (needs a QR library or a pre-made image).
- With demo sign-in on, anyone with the address can act as the demo teacher or center during the defense window; switch `DEMO_LOGINS=off` afterwards.
- Password reset e-mails are not sent in production (no mail service yet).
