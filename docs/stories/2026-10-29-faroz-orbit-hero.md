# 2026-10-29: Faroz Orbit hero

Status: **implemented and verified** (production build in Edge: desktop and 390 px, dark and light, ru/tg/en, reduced motion, pointer, touch emulation and keyboard).
Gate: G4 (Faroz homepage)   Design: handoff §4 "Main" (logo nucleus, subjects on 3D orbits, mouse tilts it) and the owner's reference image   Decisions: D-22 (Motion, no 3D library), D-23

## Context

The hero's right side was a flat ring turned by CSS. The owner asked for a premium, interactive atom: the Faroz mark in a dark sphere, three crossing orbits, gold electrons, subject cards on the orbits and a compact quest card.

## Decisions (owner, in the chat, 2026-10-29, while reviewing)

- Subjects travel **full loops** round the core (not a sway), never all going behind or coming round together.
- **No pause button** ("not appropriate"). Motion stops on hover, on keyboard focus of the atom, while dragging and off screen; with reduced motion it never runs.
- Hover **tilts the orbits toward the cursor**; dragging spins the subjects along their orbits.
- A smaller core and larger orbits; the orbits themselves only **sway slightly** (a full horizontal rotation was tried and reverted).
- Subject cards are **opaque**, always face the viewer, and stay in front of the core on the near half of an orbit.

## Changes

- `apps/web/src/features/home/faroz-orbit.tsx` (new client component `FarozOrbit`): orbits as tilted circles with a light perspective projection; paths split into behind/in-front of the core; one `requestAnimationFrame` loop writes transforms and SVG attributes (no React re-render per frame); eased speed and tilt; pointer capture, `pointercancel`/`lostpointercapture`; `touch-action: pan-y` so the page still scrolls on phones (horizontal swipes spin); keyboard focus and arrow keys; IntersectionObserver stops it off screen; staggered Motion entrance; icon-only cards and one electron per orbit under 640 px; same markup on server and client (no hydration mismatch).
- `apps/web/src/app/[locale]/(site)/page.tsx`: the old flat orbit markup replaced by `<FarozOrbit>`; the rest of the page stays a server component.
- `apps/web/src/styles/faroz-site.css`: orbit tokens for dark and light (`--orbit-cyan`/`--orbit-violet` from the logo gradient, others alias brand tokens), orbit classes; the old `fz-rot`, `fz-rot2`, `fz-tin`, `fz-orb` rules removed (used only by the old hero).
- Messages `Home.orbitHint`, `Home.orbitDemo` in tg/ru/en (ru/tg AI drafts). The quest card is the design's demo data, labelled "demo".

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` (api 171 + 96, web parity 3), web `build` | pass |
| Interaction script in Edge (scratchpad, prod build) | 31/31 twice: moves at rest; cards opaque; no pause button; hover stops and tilts toward the cursor; drag spins forward and back; drag state set/cleared; resumes after leaving; Tab reaches the atom, focus ring, focus stops it, arrow keys tilt; CTA not covered; no overflow at 1440 and 390; console clean (dark, reduced motion, mobile, ru, tg); light theme; reduced motion static; mobile icon-only, `pan-y`, fits 390 |
| Frame captures over ~60 s | cards loop round the core; at every sample three in front and three behind |
| Playwright (prod build, 1 worker), read-only specs | 6 passed: language/theme ×2, teacher journey ×2, center journey ×2. Specs that write data were not run (owner: keep demo data) |

Bug found and fixed: a mouse click or drag also focused the atom (it is keyboard-focusable), and focus held the motion; focus now stops it only when it came from the keyboard.

Not run: Lighthouse, a screen-reader pass, a real touch device (touch tested by emulation only), native review of the new ru/tg texts.

## Known limitations

- Without a pause control, WCAG 2.2.2 (Pause, Stop, Hide) is covered only by hover, keyboard focus and the reduced-motion setting; this is an owner decision.
- Cards can overlap each other briefly where orbits cross, and a front card crossing the middle covers part of the logo (owner: front cards stay in front).
- Subject cards are decorative (not links); their names are read once from the figure caption.
