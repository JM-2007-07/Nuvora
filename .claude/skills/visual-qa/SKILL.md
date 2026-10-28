---
name: visual-qa
description: Visual and interaction QA of a running Nuvora page in the browser - desktop, tablet, and mobile layouts, tg/ru/en, light/dark, reduced motion, keyboard, contrast, touch targets, loading and error states, and fit with the visual contract in docs/engineering/VISUAL_EXPERIENCE.md. Use after UI work on the homepage, catalog, lesson, quiz, or progress pages, before a G4-B/G4-E report, or when asked to check how a page looks or behaves.
---

# Visual QA

Checks what users actually see. Reports concrete findings; doesn't change code unless the user asks for fixes afterwards.

Read first: `docs/engineering/VISUAL_EXPERIENCE.md` (homepage and brand surfaces), `docs/02-design/design-system.md` (tokens, type scale, UI motion), `docs/engineering/VERIFICATION.md#browser-checks`.

## Setup

1. Start the API and web with `preview_start` using `.claude/launch.json` (`api`, then `web`). If another session already runs `next dev` in `apps/web`, Next.js refuses a second one: reuse that server if this session can reach it, otherwise check a production build (`pnpm build`, then `preview_start` with `web-prod`). Say which you used.
2. Without the local database, content pages show their error state: check that state, and report that content views were not checked.
3. Use a guest session for anything that writes (quiz submissions).

## Matrix

Pages: the ones the change touched, plus the homepage if brand surfaces changed.

| Dimension | Values |
| --- | --- |
| Viewport | 375×812 (mobile), 768×1024 (tablet), 1280+ (desktop) via `resize_window` |
| Locale | `/ru` (default), `/tg`, `/en` |
| Theme | light and dark (`resize_window` `colorScheme`, plus the in-app theme switcher) |
| Motion | normal and `prefers-reduced-motion: reduce` |

Don't screenshot every combination. Screenshot each page at three viewports in one locale and theme, then use `read_page` / `get_page_text` / `javascript_tool` for the remaining combinations (overflow, `<html lang>`, missing keys, computed styles). Keep screenshots at a reduced scale.

## What to check

**Layout and hierarchy**
- No horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`). Russian and Tajik text doesn't clip or overflow.
- One clear focal point per screen, clear reading order, consistent spacing on the 4 px grid, type scale from design-system.md.
- Mobile layouts are composed for mobile (VISUAL_EXPERIENCE.md#mobile), not a shrunk desktop.

**Identity (homepage and brand surfaces)**
- The luminous knowledge core is the focal point, built from real topic data; violet/teal light is restrained; the composition still works with motion off.
- Red flags: grids of identical cards, generic stock imagery, random glows or 3D objects without meaning, inconsistent effects, more than one animation system doing the same job, visual clutter.

**Accessibility**
- Keyboard only: skip link, visible focus (`--nv-focus-ring`), every action reachable, quiz options by arrow keys + Space, nodes in the visualization reachable as links.
- Contrast: text ≥ 4.5:1 (large text and UI boundaries ≥ 3:1). Teal and Cool Gray are never text on light backgrounds. Status is never colour alone.
- Touch targets ≥ 44×44 px on mobile.
- Images: meaningful ones have alt text, decorative ones `alt=""`.

**Motion**
- Purposeful: entrance staging and state changes, no fast loops or flashes. Only `transform`/`opacity` animate.
- Reduced motion: decorative motion stops; content and layout identical.

**States**
- Loading, empty, and error states render, are translated, and keep the layout stable.
- Console: no errors or warnings (`read_console_messages`). Network: no failed requests; no quiz correctness or explanations before submission.

**Colours in code** (quick static check of the touched files): `grep` for hex values or `rgb(` in `apps/web/src`; every hit outside token files is a finding.

## Report

1. What was checked: pages × viewports × locales × themes × motion, and the server used.
2. Findings, most severe first: severity (blocker / major / minor / polish), page and viewport/locale/theme, what is wrong, why it matters (rule or doc section), suggested fix, `file:line` when known. Attach the few screenshots that prove the key findings.
3. What was not checked and why.

Reset the viewport (`resize_window` preset `desktop`) when finished.
