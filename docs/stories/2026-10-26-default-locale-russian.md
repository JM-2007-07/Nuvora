# 2026-10-26: Russian becomes the default interface language

Status: **implemented and verified**.
Decisions: D-06 (changed by the owner, 2026-10-26)   Requirements: FR-I18N-01

## Context

The owner changed the default language from Tajik to Russian. Supported languages stay `ru`, `tg`, `en`.

## Changes

- `packages/shared/src/locales.ts`: `DEFAULT_LOCALE = 'ru'`; `LOCALES` reordered to `['ru', 'tg', 'en']`, which is the language switcher's order (Русский, Тоҷикӣ, English). No new mechanism: the web routing, the `/` redirect, and the API's `Accept-Language` fallback all read these constants. Content fallback order per locale is unchanged.
- Comments in `apps/web/src/proxy.ts` and `apps/web/src/i18n/routing.ts`.
- Tests that pinned the old default: `apps/api/src/common/i18n/locale.spec.ts` (missing/unsupported header → `ru`), `apps/api/test/content.e2e-spec.ts` (default content is Russian; two tests that are about the lesson body and the tg → ru → en fallback now request `tg` explicitly, with unchanged assertions), `apps/web/e2e/language-and-theme.spec.ts` (starts at `/ru`; new test for direct `/tg` and `/en` and for `/` ignoring an English browser).
- Docs: `decisions.md` (D-06), `architecture.md`, `requirements.md` (J1, FR-I18N-01), `mvp-scope.md`, `api-conventions.md`, `AGENTS.md`, `README.md`, `VERIFICATION.md`, `visual-qa` skill. Translation files unchanged.

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | pass |
| `pnpm test` | pass: api 106 unit + 49 e2e, web 3 (i18n key parity) |
| Playwright (`pnpm --filter @nuvora/web test:e2e`) | 2 passed on Edge |
| HTTP, production build | `/` → 307 `/ru`; with browser `Accept-Language: tg` still `/ru`; with cookie `NEXT_LOCALE=tg` → `/tg`; `/ru`, `/tg`, `/en` render `<html lang>` ru/tg/en; API without header answers `Content-Language: ru` |
| Browser | Switcher order Русский, Тоҷикӣ, English; switching to Tajik sets the cookie, links become `/tg/...`, `/` then opens `/tg`; clean console in a fresh tab |

## Known limitations

- Learners who already chose Tajik keep it (saved cookie); only new visits default to Russian.
- The demo storyline in `mvp-scope.md` stays in Tajik on purpose; its step 1 now tells the presenter to open `/tg` (or switch to Тоҷикӣ) before starting.
