# 2026-10-29: Homepage scroll reveals

Status: **implemented and verified** (production build in Edge: 1440 and 390 px, reduced motion, console).
Gate: G4 (Faroz homepage)   Decisions: D-22 (Motion; no new package)

## Context

The owner found the homepage scroll animation not smooth or striking enough and suggested AOS. Each section faded in as one block: 14 px, 0.32 s, `easeOut`. We agreed to improve it with Motion, which is already installed and approved, instead of adding AOS.

## Changes

- `apps/web/src/components/motion/reveal-group.tsx` (new): `RevealGroup` and `RevealItem`.
  - A group starts once when 12 % of it is in view. Its items, at any depth, then come in one after another (stagger 0.08–0.13 s).
  - Directions: from below, from the left, from the right, or zoomed out. A blur clears as each item settles.
  - Easing is expo-out over 0.95 s.
  - The markup is the same on server and client. Reduced motion is handled by `MotionConfig reducedMotion="user"`: no movement, only a fade.
- Homepage (`page.tsx`): every section uses it.
  - **Hero:** the text column cascades.
  - **How it works:** the title, then the learning loop zooms in.
  - **Learners:** the title, the button from the right, the photo zooming in, then the cards.
  - **Teachers:** the text from the left, the photo from the right.
  - **Centers:** the photo from the left, the text from the right.
  - **Library:** the books zoom in one by one.
  - **Pricing:** the cards cascade.
  - **FAQ** and the **final CTA** cascade too.
  - Grid placement moved onto the reveal wrappers, so the layout is unchanged.
  - `<main>` has `overflow-x: clip`, so items coming from the side never widen the page on phones.
- The workspaces keep the quicker `Reveal`.
- Bug fixed in `features/home/bars.tsx`: with reduced motion, the XP segments on the homepage stayed invisible.
  - Cause: the server rendered them hidden for the animation, and the client swapped in plain elements that kept the server's `opacity: 0` style.
  - Fix: `GrowBar` and `XpSegments` now always render Motion elements under `MotionConfig`. The bar grows with `scaleX`, so reduced motion shows it full.

## Verification

| Check | Result |
| --- | --- |
| `lint`, `typecheck`, web `test` (3/3), web `build` | pass |
| Scroll script (scratchpad), Edge, production build | Scrolled 1440 normal, 1440 reduced and 390. Every reveal item ends visible; the only hidden elements are the orbit electrons behind the core, by design. Teachers mid-scroll opacities 0.73 → 0 show the stagger. With reduced motion there is no transform. No overflow (390 was 39 px before the clip). Console clean. |
| Faroz Orbit script (31 checks) | all pass, including the CTA not being covered and no overflow |

Not run: Lighthouse (the hero text now starts hidden for its cascade, as it did before with `fz-rise`), Safari/Firefox, a real phone.
