# 2026-10-29: Sign-in and sign-up stage

Status: **implemented and verified** (production build in Edge: 1440 and 390 px, dark and light, ru/tg/en, reduced motion, keyboard).
Gate: G4 (Faroz accounts)   Design: no handoff screen for these pages; built from the Faroz Orbit hero, the HUD card and the route loader   Decisions: D-22, D-23

## Context

The owner asked for sign-in and sign-up pages that look as striking as the rest of Faroz. Before this change both were a single centred card.

## Changes

- `AuthCard` (`apps/web/src/features/auth/field.tsx`): one framed card with a glow, split into the form and a brand showcase.
  - From 960 px the two sit side by side, form first.
  - Below 960 px the showcase is a strip above the form.
  - The form logic is unchanged.
- `auth-showcase.tsx` (new): a panel on the HUD gradient with the Faroz atom (reused from the route loader), a soft orbit-coloured glow, a title, a short text and three checked points.
  - On sign-up the showcase follows the selected role (learner, teacher, center), and its text rises in again on each change.
  - On phones it shows only the small atom and the title.
- Sign-up role choice: three cards with an icon, the role and a short hint ("I learn" and so on). The selected card is mint. The cards are still radio inputs, so arrow keys work.
- CSS: `.fz-auth-frame` and `.fz-auth-glow` in `faroz-site.css`.
- Messages: `Auth.stage.*` in `messages/parts/site/{tg,ru,en}.json`. The ru and tg texts are AI drafts and **need review**.
  - The center text keeps the privacy rule: group totals and participation, never individual scores.

## Verification

| Check | Result |
| --- | --- |
| `lint`, `typecheck`, web `test` (parity 3/3), web `build` | pass |
| Edge script (scratchpad), production build | Pages checked: login and signup at 1440 in dark and light, ru/en, and tg/ru at 390. No horizontal overflow and a clean console on all of them. Reduced motion renders. The keyboard ArrowRight on the role cards switches to teacher, and the showcase follows. |

Not run:
- Playwright e2e. The specs use the owner's running dev server; the accounts journey writes data.
- Lighthouse.
- A screen-reader pass.
- Native review of the new ru/tg texts.

## Known limitations

- The second sign-up step (plan) keeps its earlier look inside the new frame.
- In the large atom, an electron's glow can touch the core's edge when it passes nearest to it.
