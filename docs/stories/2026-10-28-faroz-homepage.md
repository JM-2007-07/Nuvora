# 2026-10-28: Faroz homepage (rebrand phase 2)

Status: **implemented and verified** (production build, browser, Playwright). Not yet reviewed by the owner against the design.
Decisions: D-23   Spec: `docs/02-design/FAROZ_HANDOFF.md` §4 "Main", `screens/Main.jpg`, `screens/Main-mobile.jpg`

## Context

Phase 2 of the handoff build order: the homepage rebuilt from the "Main" artboard with the flat **Orbit** hero (the 3D atom hero stays a later upgrade).

## Changes

- `apps/web/src/app/[locale]/page.tsx`: new homepage in the artboard's order: hero (eyebrow, two-part heading, CTAs, chips, orbit with six subjects around the Faroz symbol, "quest ready" card), how it works (4 tabs with preview panels), learners (bento with photo placeholder, XP bar), teachers (misconception table), centers (group heat map), library (6 real titles with placeholder covers), pricing (concept), FAQ, final CTA. Demo numbers are the canvas data (B-12, Amina 13/20, Arrays 1/4 → 4/5).
- New: `features/home/learning-loop.tsx` (tabs, auto-advance every 5 s until picked, never with reduced motion, arrow keys), `features/home/faq.tsx` (accordion), `features/home/icon.tsx` (icon paths from the artboard).
- Header/footer: `components/site-header.tsx` (logo, section links, EN/RU/TJ buttons, theme toggle, learner menu, "Start free"), `site-header-shell.tsx` (menu button below 1080 px), `locale-buttons.tsx`, `site-footer.tsx` (added to the layout). The learner menu gained "My progress", replacing the old header links.
- `styles/faroz-site.css`: page-level tokens copied from the artboard's theme table (header background, glows, rings, core, shadows, photo frames, book covers, XP chips) plus shared `.fz-btn`, `.fz-wrap`, `.fz-kicker` classes and the orbit animations (off for reduced motion, paused on hover).
- Messages: new `Home` (replaces the knowledge-core texts), `Header` navigation keys, `Footer`, tagline translations from the artboard. Header, hero and final CTA use the artboard's ru/tj copy; **the other sections' Russian and Tajik texts were drafted by Claude** (Tajik needs native review).
- Smoke test: headline from `Home.h1a` + `Home.h1b`; language switching through the header buttons.

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` (api 106 + 49, web 3), `pnpm build` | pass |
| Playwright (2 tests) against the production build on :3001 | pass, clean console |
| Browser, 1440 px dark (en) | Every section compared with `Main.jpg`: same order, copy, layout; page height 6349 px (design 6400) |
| Browser, light; ru and tg; 375 and 390 px | No horizontal scroll; mobile order matches `Main-mobile.jpg`; menu button 44×44, menu opens, shows links/languages/CTA, closes after a link; no "Nuvora" text |
| Fixed during verification | Quest card overlapped the bottom orbit tile on phones → moved below the orbit under 640 px; a core-image preload warning → preload removed |
| Not checked | Reduced motion in a browser (CSS-only, animations live inside `prefers-reduced-motion: no-preference`); Lighthouse |

## Known limitations

- Links without a page yet: "Start" / "Take a free diagnostic" / "Open the app" go to the subject page until the diagnostic (phase 3) exists; "Start as a teacher" goes to the teachers section; Privacy and Terms are plain text; the "Open library" button is not shown until `/library` exists.
- Photo frames show the design's placeholders ("Real photo goes here"), as in the screenshots.
- `features/home/knowledge-core.tsx` is no longer used (kept; delete when convenient).
