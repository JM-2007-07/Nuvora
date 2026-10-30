# Faroz writing voice

How Faroz's interface talks to learners, teachers and centers, in Russian, Tajik and English. It applies to UI text in `apps/web/messages/**` and to lesson text. It is the writing sample for the `/humanizer` skill ([HARNESS.md](../engineering/HARNESS.md#project-skills)); where the two disagree, this document wins.

Status: written 2026-10-30 by the AI agent at the owner's request. Russian and Tajik examples need a native speaker's review (part of the open G2 Tajik copy review).

## Principles

- **Clear and short.** One idea per sentence. Say what happened and what to do next.
- **Warm but professional.** Polite, calm, no slang or hype. Faroz is a study tool, not a game ad, even where it uses game words (quest, XP, streak).
- **Confident, not boastful.** State what the product does. No "best", "revolutionary", "proves", "exactly", "guaranteed", and no learning outcomes the data doesn't show.
- **Specific.** Numbers, topics and actions instead of general praise: "7 of 24 correct", "Arrays", "Start the retest".
- **Honest about data.** Demo figures stay labelled. Caveats ("one test is a snapshot") stay where they change how a reader should read the number, once per screen.
- **For the reader, not the developer.** No API, server, database, mock-up IDs or stack names in user-facing text. Exception: the internal `/status` page.

## Address form

| Language | Form | Note |
| --- | --- | --- |
| Russian | **«вы»** everywhere, lower case | Learners, teachers and centers alike. Imperatives in the plural: «Найдите», «Начните» |
| Tajik | **«шумо»** everywhere | Plural verb forms: «ёбед», «оғоз кунед» |
| English | "you" | Plain, contractions are fine (don't, can't). **American spelling**: center, license, organize, memorized, and "practice" as both noun and verb (not "practise") |

## Glossary

Use one term per idea in each language. Russian is the source of meaning; English and Tajik follow it in their own idiom, not word for word.

| Idea | Russian | Tajik | English |
| --- | --- | --- | --- |
| Diagnostic test | диагностика | ташхис | diagnostic |
| Quest (lesson + practice + retest for one gap) | квест | квест | quest |
| Retest on new questions | повторный тест (not «ретест») | санҷиши такрорӣ | retest |
| Gap | пробел | камбудӣ | gap |
| Topic statuses | Сильная тема · Почти · Нужна практика · Не проверено | Мавзӯи қавӣ · Қариб · Машқ лозим · Санҷида нашуд | Strong · Getting there · Needs practice · Not scanned |
| Score | «Верно 7 из 24» (a plain fraction) | «7 аз 24 дуруст» | "7 of 24 correct" |
| Data computed from saved answers | по ответам | аз ҷавобҳо | from answers |
| Figures taken from the design mock-up | из макета | аз макет | from the mock-up |
| Generated demo figures | синтетические | синтетикӣ | synthetic |
| Demo data note | демо-данные | маълумоти намоишӣ | demo data |

## Privacy wording

Keep the rule from [FAROZ_HANDOFF.md](FAROZ_HANDOFF.md) and say it the same way: learners see their own results; teachers see their groups answer by answer; centers see **only group totals and participation**, never individual scores or answers. Russian: «Центры видят только итоги групп и участие».

## Errors and empty states

- Say what didn't happen, then what to do: «Не удалось сохранить. Попробуйте ещё раз через минуту.»
- Never "check that the server is running": the reader can't. Don't promise what the code doesn't guarantee.
- An empty state names the next step: «Пройдите диагностику, чтобы увидеть первый результат.»

## Punctuation

- Russian and Tajik use the dash where grammar needs it («Пробел — это…») and «ёлочки» for quotes. Don't remove them mechanically. Replace a dash only when it is a lazy connector between two thoughts.
- English keeps typographic apostrophes and quotes (’ “ ”) as in the existing catalog.
- The middle dot (·) separates short facts in labels: «Диагностика · 6 окт».
- No exclamation marks in system messages.

## Examples

| Before | After | Why |
| --- | --- | --- |
| Найди пробелы. Прокачай их. | Найдите пробелы. Закройте их. | «вы»; no slang |
| …и ретест, который доказывает прогресс. | …и повторный тест на новых вопросах. | One test doesn't prove progress (the FAQ says so) |
| One short diagnostic shows exactly which topics you know | A short diagnostic shows which topics you already know | No overclaim |
| Не удалось сохранить. Проверьте, что сервер запущен, и попробуйте снова. | Не удалось сохранить. Попробуйте ещё раз через минуту. | No developer wording |
| «Записано» — посчитано по ответам в этой БД | «По ответам» — посчитано по сохранённым ответам учеников | Same fact, plain words |
| Кем вы пользуетесь Faroz? | Как вы будете пользоваться Faroz? | Grammar |
