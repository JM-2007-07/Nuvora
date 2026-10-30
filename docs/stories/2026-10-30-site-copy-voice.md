# 2026-10-30: Site copy pass and the Faroz writing voice

Status: implemented and verified (checks and browser). Russian and Tajik wording is AI-written and **needs native-speaker review**.
Gate: G4 (Faroz defense phases)   Decisions: D-23 (Faroz brand)

## Context

The owner asked for a review of the site's texts using the third-party `blader/humanizer` skill as a content-quality tool (not an AI-detection bypass), a defined Faroz writing voice for ru/tg/en, and a report before any broad rewrite. The review covered about 1,700 strings in `apps/web/messages/**`. The main problems it found:

- Developer wording visible to users: about 12 errors said "check that the server is running"; other strings mentioned "API", "database", "the API refused the request", "this DB", "reference figures from the mock-up".
- A grammar error on the role choice page: «Кем вы пользуетесь Faroz?».
- Mixed address forms: the homepage used «ты»/«ту», the apps and start page «вы»/«шумо».
- Two Russian terms for one idea: «ретест» (11) and «повторный тест» (26).
- Homepage overclaims: «ретест, который доказывает прогресс» (the FAQ on the same page says one test doesn't prove mastery), "shows exactly", «Прокачай их», «Самый полезный».

The owner approved the integration plan and the edit order in the chat.

## Decisions

- **Humanizer vendored, not installed as a plugin.** `SKILL.md` (v3.1.0, commit `0ef9fe5`, MIT) and `LICENSE` were downloaded at that commit, read in full, and copied to `.claude/skills/humanizer/`. It is instructions only. A Faroz rules block at the top overrides the upstream file: §8 (no dashes) and §21 (straight quotes) don't apply to Russian and Tajik; facts, data-source labels, keys and ICU placeholders never change; Tajik stays marked for review; screens are reviewed in context first. Explicit invocation only (`skillOverrides` in `.claude/settings.json`). No existing skill covered copy, so nothing is duplicated.
- **Voice document.** New [VOICE.md](../02-design/VOICE.md): principles, «вы»/«шумо»/"you" everywhere, a glossary (one term per idea), privacy wording, error and empty-state rules, punctuation, before/after examples.
- **Data-source labels kept, reworded.** recorded → «по ответам» / "from answers" / «аз ҷавобҳо»; reference → «из макета» / "from the mock-up" / «аз макет»; synthetic unchanged. Same meaning, plain words, one wording in every place.
- **Not changed on purpose:** the internal `/status` page (developer page), the learner caveats about snapshots and before/after (each screen shows its caveat once and it changes how to read the number), the privacy sentences (consistent in meaning; VOICE.md fixes the wording for new text), lesson content in `apps/api/src/seed/content/`.

## Changes

- `apps/web/messages/{ru,en,tg}.json` and `parts/{site,work,assess}/{ru,en,tg}.json`: 120 string values (string values only; keys and placeholders checked unchanged by the edit script).
  - Homepage: «вы»/«шумо», «Найдите пробелы. Закройте их.», sub-heading without "proves"/"exactly", «повторный тест» everywhere, pricing title, «Рекомендуем» badge, FAQ privacy answer now says "group totals and participation".
  - Errors: "check that the server is running" → "try again in a moment"; offline message without "API or database".
  - Staff pages: access and permission notes without "server/API"; invitation note says Faroz doesn't send emails.
  - Center and teacher data notes and labels as above.
  - Role choice title: «Как вы будете пользоваться Faroz?» / "How will you use Faroz?".
  - English spelling made American throughout, as most of the catalog already was (center, organize, license): practise → practice (verb), centre → center, licence → license, memorised → memorized (10 values). Keys such as `practiseNext` are unchanged.
- `.claude/skills/humanizer/` (new), `.claude/settings.json`, `CLAUDE.md`, `docs/engineering/HARNESS.md` (skill table and external-skills entry), `docs/README.md` (map row), `docs/02-design/VOICE.md` (new).

## Verification

- `pnpm lint`: pass. `pnpm typecheck`: pass. `pnpm test`: pass (web i18n key parity 3/3; api 192 + 116). `pnpm build`: pass.
- Browser, production build (`web-prod`, port 3001), 390 px:
  - `/ru` dark: new hero, no horizontal overflow.
  - `/tg` light: hero and section headings in «шумо» form, pricing badge «Тавсия мешавад», no overflow.
  - `/ru/start` dark: new title on three lines.
  - `/ru/center` and `/tg/center` dark (demo center): «по ответам» / «из макета» / «синтетические» labels and the compare note, no overflow.
- Not checked in the browser: the changed error messages (they need a failing API), the teacher assessment list, group wizard and invitation pages, English pages.

## Known limitations and follow-ups

- **Native-speaker review:** all changed Russian and Tajik strings, and the Tajik examples in VOICE.md, are AI drafts. Part of the open G2 Tajik copy review.
- Remaining copy not yet passed through `/humanizer`: learner app, teacher workspace, chats and profiles (lower priority; no developer wording left there except `/status`).
- Unused homepage keys (`Home.photoHere`, `Home.photo`, `Home.*Photo`) are still in the catalogs; remove them in a code change.
- Updating humanizer from upstream drops the Faroz block; re-add it (noted in HARNESS.md and CLAUDE.md).
