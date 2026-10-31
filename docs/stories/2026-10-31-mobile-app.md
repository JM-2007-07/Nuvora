# 2026-10-31: Native mobile app (learner, teacher, center, exam, offline, PIN)

Status: **implemented; verified in the Expo web preview at 375 px and with a Metro Android bundle export.** Not verified: a run on an Android device or emulator, iOS, real biometrics, push notifications (not built).
Gate: G4 (Faroz), roadmap row 12   Decisions: D-29 (mobile), D-26 (sessions and bearer tokens), D-28 (exam mode)

## Context

The owner asked (Oct 30, late evening) to continue the mobile app on its own and make it look and work well, using the "Full product implementation" directive: Expo with Expo Router, TanStack Query, shared Zod contracts, secure token storage, its own native design system, dark/light/system themes, ru/tg/en, motion that respects reduced motion, safe areas, the three roles, biometric re-entry and an optional PIN with an attempt limit, offline learning with a sync queue (official exams stay online), Android first, no store publishing. The foundation (`651680b`, `00e874b`) had sign-in, empty tabs and settings.

## Decisions

- **Native design system, not web copies.** `components/ui.tsx` holds the app's own pieces (screen, card, HUD gradient, buttons, pills, rows, segmented control, progress ring and bar, skeletons, empty and error states), with springs and haptics. Colours and gradients come only from `assets/brand/faroz/tokens.css`, generated into `src/theme/tokens.ts` by `scripts/gen-tokens.mjs` (`--check` runs in `typecheck`).
- **Fonts:** Unbounded for headings and Inter for text, as on the site; Tajik headings use Inter because Unbounded lacks ҳ ҷ ӣ ғ қ ӯ.
- **Offline learning:** lessons with their practice quiz can be saved on the device (`expo-file-system`); practice answered offline goes into a queue that is sent when the device is online again. Official exams never run offline: the server keeps the clock and the score.
- **Exam on the phone:** answers are saved at once with sequence numbers (idempotent on the server), unsent answers and sequence numbers are kept on the device, leaving the app and losing the network are reported as signals for the teacher (`APP_BACKGROUND`, `OFFLINE`, …), and the teacher's pause, warnings and extensions are followed by polling every 10 s.
- **PIN:** 4 digits, stored as a salted SHA-256 hash in secure storage, 5 attempts, then the app signs out. It is a convenience on this phone, not a replacement for the password. The app locks again after 60 s in the background.
- **Web preview** (`mobile-web` in `.claude/launch.json`, Expo web on :8081) is a development surface only; it keeps tokens in `localStorage`. The API allows the `localhost:8081` origin in development (`app.setup.ts`, origin callback).
- **Packages** (owner approved "everything needed" for the Expo stack on 2026-10-30): `@expo-google-fonts/inter` 0.4.2, `@expo-google-fonts/unbounded` 0.4.1, `@expo/metro-runtime` 58.0.15, `expo-blur` 58.0.5, `expo-crypto` 58.0.7, `expo-file-system` 58.0.13, `expo-font` 58.0.11, `expo-linear-gradient` 58.0.3, `expo-splash-screen` 58.0.12, `lucide-react-native` 1.57.0, `react-dom` 19.3.0, `react-native-svg` 15.16.0, `react-native-web` 0.21.4. No install scripts were allowed.

## Changes

- **Learner:** home (level ring, XP, streak, next step, assigned tests, offline queue, skills, before/after), learning path, topic, lesson (Markdown renderer with code blocks, download for offline, mark complete), practice quiz with result, assigned tests, native exam runner and result with animation, library, settings.
- **Teacher:** overview of groups, group analytics (topics, hardest questions), a student's answers, published exams, live board (progress, signal chips, connection dot, warn/pause/resume/extend/flag/end with confirmation, event feed).
- **Center:** group totals and participation only, no per-learner scores or answers (the exams tab is hidden for center staff).
- **Account and security:** demo and password sign-in with the two-factor code, refresh rotation, sign out and sign out everywhere, devices, biometrics, PIN setup and lock screen; sign-out also drops the offline practice queue, so the next person on the phone can never send someone else's answers.
- **Fixes found during the browser run (this session):** requests waited for nothing on a cold start, so screens that rendered before the saved session was read went out without a token (`api()` now waits for it); the wrong-area redirect could loop between the two tab groups; reopening a finished attempt said "no attempts left" instead of showing the result; answers that failed while the server was down were not retried until the network state changed; status pills squeezed exam titles (new `badge` slot in `Row`).
- **Tests:** `test/markdown.test.mjs` (Markdown parser) and the ru/tg/en key parity test.

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @nuvora/mobile typecheck` (token check + `tsc`) | pass |
| `pnpm --filter @nuvora/mobile test` | 6/6 pass |
| `pnpm --filter @nuvora/mobile bundle:android` | pass: Hermes bundle 7.3 MB exported |
| `pnpm --filter @nuvora/api lint` / `typecheck` / `test` (CORS change) | pass / pass / 119/119 |
| Browser, Expo web preview, 375×812, against the local API and `nuvora_dev` | Amina: sign-in, home, topic, lesson, offline download, practice and result, tests list, a full exam (intro, answers, resume after reload, server-down banner and recovery, submit confirmation, result 4/5 · 80 %), PIN setup, lock on reload, wrong code ("4 attempts left"), unlock, sign-out. Dilshod: overview, group B-12 analytics via a direct link, exams list, live board showing Amina's submission. Farhod: overview and B-12 totals/participation. Dark/ru and light/tg checked |

**Database writes:** demo sign-ins created session rows; for the exam run one teacher assessment ("Functions — mobile check", B-12, 25 min, closes 31.10 15:49) was duplicated from an existing one and published in `nuvora_dev`, and Amina submitted one attempt. `pnpm db:seed:demo` resets demo learners; the extra assessment stays until the teacher removes it.

## Known limitations and follow-ups

- Not run on a device or emulator yet: needs Android Studio or Expo Go on a phone on the same network (`EXPO_PUBLIC_API_URL=http://<laptop-ip>:4000/api/v1`).
- Push notifications are not built: a device-token table (migration, owner review) and Expo push credentials are needed.
- The practice queue has no idempotency key: a retry after a lost response can store an attempt twice.
- In the web preview, typing `/settings` opens the learner route for any user, because both tab groups share the URL. Inside the app the tabs navigate by name.
- Some teacher content and handoff mock data are English-only in ru/tg (e.g. question 5 of the test, "Arrays" in a mock group).
