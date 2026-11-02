# 2026-11-02: AI assistant on Gemini (18+)

Status: **implemented; verified with unit and real-database integration tests and in the browser on a production build, all with a mock model.** Not verified: a real Gemini call (no API key exists yet), the mobile app (not changed), real push delivery. Not committed to Render: nothing is pushed.
Gate: G4 (Faroz)   Decision: D-32 (proposed)

## Context

The owner asked for an AI assistant: a person can ask about anything they did not understand, have tests created from uploaded files, and have a topic created from a request. The owner chose Gemini and, because Google's terms set an 18+ limit, access only for people aged 18 and over, with a notice on the 18th birthday. The owner asked to be consulted only where unavoidable.

## Decisions

- **Interactions API over plain `fetch`, no package.** Google's docs recommend it for new projects. `store: false`, so Google keeps no conversation state for us. Default models (changed after the first real calls, see the update below): `gemini-3.6-flash`, then `gemini-3.5-flash-lite` for chat; `gemini-3.6-flash`, then `gemini-3.5-flash` for generation (`AI_MODEL_CHAT`, `AI_MODEL_GENERATE`: one id or a comma-separated list). `AiModel` is an abstract class, so the provider can change in one place.
- **Date of birth on the account, set once, self-reported.** Asked at sign-up on the site, optional in the API because the built APK does not send it; existing accounts are asked inside the assistant or in settings. It is not shown to anyone, including teachers and centers. A correction goes through the team.
- **Access rules, on the server:** account 18+ → available; under 18 → locked with the opening date; no date → asked for it; guests → no. Demo profiles have no date of birth and are off unless `AI_DEMO_PROFILES=on`. Center roles have no assistant. Age uses the Dushanbe date; 29 February birthdays fall on 1 March in other years.
- **Under-18s see nothing new except one settings line**: no menu item, no buttons; the API answers 403 before any model call.
- **The 18th birthday:** an account created under 18 has `aiNoticePending`. Once 18, the next page load shows a banner until dismissed. With `PUSH_SCHEDULER=on` a one-off push (`ai_available`) goes out too. The category stays out of the preference lists, so the built APK does not meet an unknown value.
- **Chats are not stored.** The client sends the conversation; the server adds material it has checked the person may read (lesson, published teacher lesson of their group, their own submitted attempt). Correct answers of unsubmitted tests never reach the model.
- **No help during a test:** a learner with a running attempt at a teacher's test gets 409 `AI_EXAM_ACTIVE`.
- **Teacher output is always a draft.** Tests go to the existing builder as unpublished assessments; a topic adds a `teacher_lessons` draft. Nothing reaches students until the teacher publishes. Model output is validated again (known topics, one valid correct option, requested languages only).
- **Background jobs, polled by the page:** long generations survive proxies. Files stay in memory for the run and are never stored; bytes are checked, not just the declared type. `.docx` is read on the server with `node:zlib`, because Gemini does not read it. Uploads stop at 8 MB, below the site proxy's 10 MB body limit.
- **Costs:** per person per day 40 chat requests and 10 generations; `AI_DAILY_LIMIT` (default 1000) is the hard stop for the platform; failed requests are given back. Counters are in `ai_usage`, so restarts do not reset them.

## Changes

- **Schema:** migration `20261102100000_ai_assistant` (additive): `accounts.birthDate`, `accounts.aiNoticePending`, `ai_usage`, `ai_jobs`, `teacher_lessons`. Applied to `nuvora_test` and `nuvora_dev`; checksum pinned.
- **API:** `apps/api/src/ai/` (rules, model client, prompts, files, chat, jobs, teacher lessons, controllers); `me/ai/*`, `me/birth-date`, `me/teacher-lessons`, `teach/ai/*`, `teach/birth-date`, `teach/lessons`; registration takes `birthDate`; scheduler notice; rate limits.
- **Shared:** `ai-api.ts`, `ALWAYS_ON_CATEGORIES`.
- **Web:** `features/ai/` (chat, side sheet, date-of-birth form, notice, teacher studio, lesson editor, learner lessons); "Ask the assistant" on lessons and on each reviewed question; assistant pages; date of birth at sign-up; settings card; privacy section; messages part `ai` in ru/tg/en (needs native review).
- **Hosting:** `GEMINI_API_KEY` in `render.yaml` (asked at deploy, never stored in the repo).

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @nuvora/api exec vitest run src/ai` | 18/18 |
| `pnpm --filter @nuvora/api test:int` on `nuvora_test` (15 new in `ai.int-spec.ts`) | 64/64; one earlier run ended with a worker crash and no failed test, as in earlier stories |
| `pnpm lint`, `typecheck`, `seed:check`, `db:validate`, `build` | pass |
| `pnpm test` | api 271 unit + 119 e2e, web 7, mobile 9: pass (the notification test now counts the one-off category on purpose) |
| Playwright on the production build (:3001, API :4000) | accounts journey with the new date field, learner journey, center journey: pass. Language and theme: failed once on a language switch, then on a suspended network; teacher journey: fails because Amina in `nuvora_dev` has extra attempts from earlier checks (no file of this change is involved). The dev server on :3000 from another session did not answer and was left alone |
| Browser, production build, API with `AI_PROVIDER=mock` | Streaming through the site's proxy arrives in pieces (0, 45, 90 ms). Amina: assistant page, lesson sheet (focus in the input, Enter sends, no overflow), reviewed question. Dilshod: draft topic → lesson editor → publish; Amina sees it in quests and reads it, with the AI note. Under-18 account: no menu item, settings line, locked page, API 403. Sign-up in tg shows the date field. 390 px in ru and tg, dark and forced light: no horizontal scroll |

Found and fixed in the browser: the sheet's first focus was on Close, so Enter closed it; the teacher form overflowed at 348 px.

**Database writes:** both migrations steps above; demo sign-ins created session rows; a test account `ai-check-minor@demo.tj` (random discarded password) remains in `nuvora_dev`; the mock draft test and lesson were deleted through the API; Amina's and Dilshod's usage counters have a few requests today.

## Known limitations and follow-ups

- **Google's terms:** the 18+ split covers who uses the assistant, but the Gemini API terms also bar use in a service "likely to be accessed" by under-18s, and Faroz has school students. The owner decided to go ahead with the split; this should be checked with Google or a lawyer before real students use it.
- **Needs from the owner:** a Gemini API key with Cloud Billing (a subscription does not include API use), and turning off or shortening request logging in Google AI Studio (on by default, up to 55 days).
- The real model has never been called. Parsing follows Google's documented event shapes; the first real request may need small corrections. Safety blocks in the Interactions API are not fully documented; an empty answer is treated as blocked.
- The date of birth is self-reported.
- Not on the mobile app yet (web only; a new APK is needed), and teacher lessons have no question from the mobile side.
- Daily limits in the proxy-level rate limiter are per instance; the daily counters are in the database.

## Update the same day: first real calls to Gemini

The owner added a key to `apps/api/.env` and asked for a check. It ran on a second local API (:4010, built from this branch); the owner's own servers were not touched.

- **The key is on Google's free tier.** `gemini-4-argon` answers 429 `too_many_requests` ("limit: 0 ... on Free Tier"). On the free tier Google may use prompts and answers to improve its products, so Cloud Billing must be on before real people use the assistant.
- **`gemini-3.8-flash` and `gemini-3.7-flash` did not answer within 60 seconds** (generateContent and Interactions alike; `gemini-flash-latest` answered 503 "high demand"). `gemini-3.6-flash`, `gemini-3.5-flash` and `gemini-3.5-flash-lite` answered in 1–2 s (streaming) and about 12 s (structured output).
- **Change:** default models moved to `gemini-3.6-flash` with a fallback; the client tries the next model when one answers 429/503, fails to connect, or sends no text within 25 s (chat) or 150 s (structured output). `modelList()` reads the environment (unit-tested).
- **Event format confirmed:** `interaction.created`, `interaction.status_update`, `step.start`, `step.delta` (`delta.type: "text"`), `step.stop`, `interaction.completed`, then `event: done` / `data: [DONE]`; structured output comes as `thought` and `model_output` steps. The parser needed no change.

| Real check (adult test learner and teacher accounts in `nuvora_dev`) | Result |
| --- | --- |
| Chat about the lesson "js-arrays-methods-return" in Russian | first text after 6 s, done after 7 s; correct answer with an example and a check question |
| Test from a text file (3 questions, ru) | done in about 12 s; 3 valid questions, ru filled, tg empty, unpublished draft |
| Topic "closures" (3 questions, ru) | done in about 18 s; lesson "Замыкания в JavaScript" and 3 questions on `js-functions` |
| Topic in Tajik | lesson in Tajik (needs native review) |

A first topic run returned a lesson about arrays because the shell sent the Russian text in the wrong encoding; sent as UTF-8 (as the browser does) it was correct. The drafts were deleted. Test accounts `ai-check-adult@demo.tj` and `ai-check-teacher@demo.tj` (random, discarded passwords) and the group "AI check group" remain in `nuvora_dev`.

Not checked with the real model: PDF and image uploads, the browser screens (checked earlier with the mock model).
