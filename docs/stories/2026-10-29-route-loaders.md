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

## Known limitations

- Pages that fetch on the client still show their own `LoadingState` skeleton after the route loader, so a slow API means two loading steps in a row.
- Smooth crossfades between pages (React `<ViewTransition>`) are not part of this change.
