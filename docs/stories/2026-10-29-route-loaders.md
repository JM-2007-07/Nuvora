# 2026-10-29: Faroz route loaders

Status: **implemented and verified** (Edge: dark and light, ru/tg, reduced motion, 1440 and 390 px).
Gate: G4 (Faroz learner, teacher and center workspaces)   Design: handoff §3 ("Skeleton loading uses the shimmer gradient"), Faroz Orbit hero   Decisions: D-22, D-23

## Context

Navigations had no loading state: no route had a `loading.tsx`, so a click left the old page frozen until the new one was ready. The owner noticed this in `next dev`, where routes also compile on first visit (the "Compiling" / "Rendering" indicator); in the production build that compile step does not exist. The owner asked for loading pages in the Faroz style.

## Changes

- `apps/web/src/components/faroz-loader.tsx` (new):
  - `FarozAtom`: a mini Faroz Orbit with the mark in the core, cyan/blue/violet orbits and gold electrons (SMIL `animateMotion`); the core and aura breathe. Under reduced motion the electrons stand still and nothing pulses.
  - `PageLoader`: the atom centred with the label.
  - `WorkspaceLoader`: atom, label and shimmer skeletons rising in a cascade.
  - Both appear only after 200 ms (`fz-delayed`), so fast navigations never flash, and both announce themselves with `role="status"`.
- `loading.tsx` files:
  - `PageLoader` for `(site)` and `app/(focus)`.
  - `WorkspaceLoader` for `app/(shell)`, `teach` and `center`, where the sidebar stays and only the content area shows the loader.
- `apps/web/src/styles/faroz-site.css`: loader classes (orbit tokens, gold electrons, breathe animations, reduced-motion swap).
- Messages: `Loader.label` in tg/ru/en. The ru and tg texts are AI drafts and **need review**.

## Verification

| Check | Result |
| --- | --- |
| `lint`, `typecheck`, web `test` (parity 3/3), web `build` | pass |
| Temporary preview page (deleted before commit), dev server, Edge | both loaders render in dark and light; electrons move; ru label |
| Playwright (scratchpad, read-only) | reduced motion: moving electrons hidden, still ones shown, core not animated; normal motion: the opposite; tg label correct; no horizontal overflow at 1440 and 390; console clean |

Not run:
- A throttled real navigation that holds a loader on screen.
- Lighthouse.
- A screen-reader pass.
- Native review of the ru/tg label.

## Follow-up the same day: page transitions

The owner approved smooth page changes.

**Changes**

- `apps/web/src/components/page-transition.tsx` (new): React 19.3 `<ViewTransition>` keyed by the path. The old page fades up and out in 140 ms; the new one waits, then rises 12 px with a soft blur. No package was added.
- Where it runs: the site layout (around the page, between header and footer) and `WorkspaceShell` `<main>` (learner, teacher, center).
- Anchoring: the site header, the workspace sidebar and the mobile bar have view-transition names, so they stay put. The root swaps without a crossfade, so only the content moves.
- Clicks pass through during the animation.
- Reduced motion: only a short opacity crossfade, with no movement or blur.
- Browsers without the View Transitions API just swap the page.
- Removed: the old CSS fade in `[locale]/template.tsx` (`fz-page-in`), so the two animations do not stack.

**Verification**

- `lint`, `typecheck`, web `test` (3/3) and web `build` pass.
- Production build, headless Edge (scratchpad script; demo learner sign-in, which only reads):
  - home → library, dashboard → skills and skills → progress: one view transition each, running `fz-page-out` and `fz-page-fade` + `fz-page-rise`.
  - Reduced motion: `fz-page-dim` only.
  - Console clean.
  - Mid-transition frame: the sidebar is sharp and still, and the content fades in.
- Not run:
  - The Playwright e2e specs. They use the dev server on :3000 that the owner was running, and running them against it was not permitted in this session.
  - Safari and Firefox.

## Known limitations

- Pages that fetch on the client still show their own `LoadingState` skeleton after the route loader, so a slow API means two loading steps in a row.
- Browser back/forward also animates (same fade). There is no direction-aware slide.
- `PageTransition` remounts the page subtree on every path change, as a navigation does anyway. State inside a page does not survive a path change.
