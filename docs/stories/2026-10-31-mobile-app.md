# 2026-10-31: Native mobile app (learner, teacher, center, exam, offline, PIN)

Status: **implemented; verified in the Expo web preview at 375 px, with a Metro Android bundle export, and (part 2) with real-database integration tests for idempotent practice and push.** Not verified: a run on an Android device or emulator (none on this machine), iOS, real biometrics, real push delivery (needs EAS and Firebase credentials).
Gate: G4 (Faroz), roadmap row 12   Decisions: D-29 (mobile), D-26 (sessions and bearer tokens), D-28 (exam mode), D-30 (push, proposed)

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

## Part 2 (same day): idempotent practice, push notifications, Android checklist, formatting

The owner asked to finish the open items of part 1 (directive "Mobile completion: reliability & push notifications"). Nothing below is committed yet.

### Idempotent offline practice

- **Server:** `POST /quizzes/:slug/attempts` takes an optional `Idempotency-Key` header (shared `IdempotencyKeySchema`). Migration `20261031090000_practice_idempotency` adds `quiz_attempts.idempotencyKey` and `requestHash` (nullable) and a unique index on (`userId`, `idempotencyKey`). The service looks the key up first; if two copies race, the unique index lets one insert win and the other returns the winner's attempt. The same key with different answers → 409 `IDEMPOTENCY_KEY_REUSED`. Keys are scoped to the signed-in learner. A refused request stores nothing. Retries answer `201` with the stored attempt and `Idempotent-Replayed: true`. Retention: the key lives with its attempt (history is never deleted).
- **App:** every queued submission gets a UUID (`expo-crypto`) when it is queued; queue entries from the earlier version get one before their first send, and the queue is saved before sending, so a crash or restart retries with the same key. The online quiz screen sends a key too and, when the network fails, queues the same key (the server may already have stored it). Fixed on the way: adding to the queue used to drop entries beyond 50, including unsent ones; now only old synced entries are trimmed. Pure rules in `src/lib/queue-rules.ts`.

### Push notifications (D-30, proposed)

- **Server** (`apps/api/src/notifications/`): migration `20261031110000_push_notifications` (`push_devices` tied to the registering session, `notification_preferences`, `notification_deliveries` with unique (`subject`, `dedupeKey`)); endpoints `POST /notifications/devices`, `POST /notifications/devices/unregister`, `GET`/`PUT /notifications/preferences`. `NotificationsService.notify` checks role → preference → claims the delivery row → sends to active devices in each device's language → switches off tokens the push service rejects; failures are logged and never break the action. Triggers: publishing a test (group learners), a submission (owning teacher, counts only), an attempt ended by time or by the teacher (learner), an invitation accepted (center admins). Scheduler (`PUSH_SCHEDULER=on`, every 10 min, repeat-safe): upcoming tests, results after close, daily reminders, evening group activity, weekly center summary, delivery cleanup after 90 days. Delivery behind `PushTransport`: `log` (default, sends nothing), `expo`, `off`. Texts in ru/tg/en (Tajik needs review). Audited: `push.device.register` / `reassign` / `unregister`.
- **App:** `expo-notifications` 58.1.7 and `expo-device` 58.0.5 (via `expo install`, exact pins, no install scripts). `src/lib/push.ts`: status; permission asked only after "Turn on" on an explanation card (home, once) or in settings; token registered for the session and language, again at start and on language change; unregistered before sign-out; foreground banners; taps open the notification's in-app path (only paths allowed by `isPushPath`). Settings → Notifications: status, switch for this phone, "open phone settings" when denied, and the role's categories.
- **Credentials needed for real delivery** (none exist in the repo; nothing was invented or bought): an Expo account and EAS project (its `projectId` in `app.json` → `extra.eas.projectId`), a Firebase project with `google-services.json` and an FCM v1 service-account key uploaded to EAS (Android), an Apple Developer account and APNs key (iOS, paid), a development or release build (Expo Go on Android cannot receive pushes), then `PUSH_DELIVERY=expo` on the API. `EXPO_ACCESS_TOKEN` only if enhanced push security is turned on.

### Android device verification

No Android SDK, emulator, adb or Java on this machine, so no runtime check on Android was possible. A repeatable checklist was added to [VERIFICATION.md](../engineering/VERIFICATION.md#mobile-app-android-checklist). Verified instead: the Metro Android bundle, the web preview (settings → notifications on a separate origin, `127.0.0.1:8081`, so the owner's open preview session was not touched), unit and integration tests.

### Formatting

`.prettierrc` sets no `printWidth` (default 80), but the code base is written with long lines (up to ~300 characters): 522 of 554 checked files differ at 80, still about 300 at width 200 (wrapping style), and 88 working-copy files are CRLF because of `core.autocrlf=true` (the index is LF). No CI runs `format:check`. Only one safe change was made: `"endOfLine": "auto"` (no file changes; stops CRLF working copies from failing the check). Reformatting would touch almost every file, so it was not done; see follow-ups.

### Verification (part 2, real output)

| Check | Result |
| --- | --- |
| `prisma migrate diff` (schema → schema) vs both migrations | identical SQL |
| `pnpm --filter @nuvora/api test:int` on `nuvora_test` (8 idempotency + 8 push + 31 existing) | 47/47 pass |
| `pnpm --filter @nuvora/api test` (unit + e2e) | 242/242 and 119/119 pass, no unhandled errors |
| `pnpm db:migrate` on `nuvora_dev` | both migrations applied; checksums pinned in `migrations-integrity.spec.ts` (46/46) |
| Live check against the dev API as Amina: one key sent twice, then other answers with the same key | `201` → `201` + `Idempotent-Replayed: true`, same attempt id; `409 IDEMPOTENCY_KEY_REUSED` |
| `pnpm --filter @nuvora/mobile typecheck` / `test` | pass / 9/9 |
| `pnpm --filter @nuvora/mobile bundle:android` | pass |
| Web preview (`127.0.0.1:8081`, 375×812, ru, dark) | Settings → Notifications: explanation, "no notifications in the web preview", four learner categories from the server; a switch round trip saved and restored on the server |
| Repo-wide `pnpm lint` / `typecheck` / `test` / `build` | pass / pass / web 7/7, mobile 9/9, api 242/242 + 119/119 / pass (web compiled). The repo-wide integration run first caught a timing bug in the new push test (it read a delivery row before the send finished); after the fix, 3 runs in a row: 47/47 |

**Database writes:** both migrations on `nuvora_test`, then `nuvora_dev` (approved flow). The live idempotency check stored **one practice attempt for demo learner Amina** (Functions, 40 %) in `nuvora_dev`, which changes her Functions mastery in the demo; `pnpm db:seed:demo` resets it (owner approval needed, not run). The preference switch was turned back on. Demo sign-ins created session rows.

## Known limitations and follow-ups

- Not run on a device or emulator: follow the [Android checklist](../engineering/VERIFICATION.md#mobile-app-android-checklist) on a phone (Expo Go for screens; a development build for push).
- Real push delivery is untested: needs the credentials listed above and `PUSH_DELIVERY=expo`. Expo push receipts (delivery confirmation after the ticket) are not checked yet; only ticket errors switch tokens off.
- `learning_task` has no sender yet (teachers cannot assign practice yet).
- Anyone who knows another phone's Expo push token could register it to their own account and so stop that phone's notifications for its owner (they would not see the owner's notifications). Tokens are not public; acceptable for the MVP.
- Formatting: decide a `printWidth` close to the code (e.g. 160) and run one formatting-only commit after the defense, with its hash in `.git-blame-ignore-revs`, then add `format:check` to CI.
- In the web preview, typing `/settings` opens the learner route for any user, because both tab groups share the URL. Inside the app the tabs navigate by name.
- Some teacher content and handoff mock data are English-only in ru/tg (e.g. question 5 of the test, "Arrays" in a mock group).
