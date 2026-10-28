# 2026-10-28: Faroz foundation (rebrand phase 1)

Status: **implemented and verified**; pages not yet restyled to the screenshots.
Decisions: D-23 (rebrand to Faroz, owner, 2026-10-28)

## Context

The owner replaced the Nuvora brand and design with **Faroz** ("Faroz — Game Mode" canvas, `docs/02-design/FAROZ_HANDOFF.md`). This is step 1 of the handoff's build order: tokens, fonts, theme, logo. Existing logic is unchanged.

## Changes

- Brand files: `assets/brand/faroz/` (logos, symbols, app icons, favicons, `tokens.css`, `tokens.json`), copied to `apps/web/public/brand/faroz-*.svg`, `public/icon-192.png`, `icon-512.png`, and `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`. Old Nuvora files remain but are no longer referenced.
- `apps/web/src/styles/faroz-tokens.css` (copy); `globals.css` maps shadcn/Tailwind to Faroz tokens, the `dark:` variant follows `data-theme`, status colours use mint/gold/magenta. Faroz `--muted` (text colour) is not overwritten by shadcn's `--muted`.
- Theme: next-themes with `data-theme`, dark by default, light as the alternative, stored as `faroz-theme`; sun/moon toggle instead of the three-way menu.
- Fonts: Unbounded (headings, wordmark; variable, Cyrillic incl. Tajik) replaces Poppins; Inter unchanged.
- Logo: symbol + live name ("Faroz", "Фароз" on Tajik pages) from `Brand.name`.
- Messages: every visible "Nuvora" → "Faroz" (en/ru) / "Фароз" (tg); tab title per locale.
- Playwright smoke test: checks `data-theme` (dark by default, toggle, persistence across language switches).
- Docs: decision D-23, `CLAUDE.md` design section, `docs/02-design/FAROZ_HANDOFF.md`.

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, web i18n test, `pnpm build` | pass |
| Playwright (2 tests) against the production build on :3001 | pass, clean console |
| Browser | `data-theme="dark"` by default, body `#0A0B14`; toggle → light `#F4F5F8`, saved as `faroz-theme`, kept after navigation; Unbounded headings, Inter text; Faroz/Фароз wordmark and favicons; no "Nuvora" text; 390 px: no horizontal scroll, toggle 44×44 |
| Not run | `pnpm test` for the API (no API change); Lighthouse |

## Follow-ups

- Phase 2: homepage to `Main.jpg` (the old knowledge-core homepage still uses legacy Nuvora primitives).
- Remove the unreferenced Nuvora brand files and `brand-tokens.css` once nothing uses them.
- Superseded docs (BRAND_GUIDELINES, design-system, VISUAL_EXPERIENCE, HOMEPAGE_BRIEF) need rewriting for Faroz.
