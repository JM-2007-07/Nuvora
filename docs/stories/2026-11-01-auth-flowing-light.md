# 2026-11-01: Sign-in and sign-up: Flowing Light panel and the panel slide

Status: implemented and verified in the browser (desktop, tablet, 390 and 375 px; ru, tg, en; dark and light). Reduced motion checked by reading the CSS rules only. Demo sign-in and a successful sign-in were not run in the browser.
Gate: G4 (Faroz defense phases)   Decisions: D-22 (Motion; no 3D), D-23 (Faroz)

## Context

The sign-in and sign-up screen had the Faroz atom (the homepage's orbit look) on its brand half. The halves swapped sides through React view transitions between two separate routes. The owner asked for a calmer, premium version: no atom, a "Flowing Light" panel, and one smooth "cinematic slide" between sign-in and sign-up. API calls, sessions, redirects, two-factor sign-in, password reset and demo entry must all keep working.

## Decisions

- **One screen for both URLs.** `/login` and `/signup` both render `AuthExperience`. The mode follows `usePathname()`. The "Create one" and "Sign in" links switch it with `window.history.pushState`, which Next.js 16 syncs with `usePathname` (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API"). The component stays mounted, so the panel can move as a real element. Back and forward animate the same way. A reload, a modifier-click or no JavaScript still loads the real page, because the links keep their hrefs.
- **CSS transitions, not view transitions or Motion.** View transitions animate flat snapshots, so the ribbon layers couldn't move at different speeds inside them. Only `transform`, `translate` and `opacity` animate. There is no JS animation loop, canvas or WebGL, and no `backdrop-filter`. The ribbon blur is baked into the SVG (`feGaussianBlur`), so a moving layer is a ready-painted surface.
- **Timing:** the panel slides in 640 ms on `cubic-bezier(0.65, 0, 0.25, 1)`, with no overshoot. The leaving form fades out in 300 ms, moving 28 px in the panel's direction. The new form fades in over 460 ms after a 200 ms delay, as the panel uncovers it. Panel copy cross-fades in 380 ms with a 24 px shift. The ribbon layers shift 3% / 5.5% / 8% over 860 / 740 / 640 ms, so the back layers lag a little. At rest each layer drifts about 1% over 17–26 s.
- **Phones (< 960 px):** no panel and no slide. A compact brand strip (the same ribbons) sits above the form, and the forms cross-fade.
- The leaving form stays mounted (and `inert`) only for the length of the slide. After that only one form is in the DOM, so password managers see one set of fields.

## Changes

- `apps/web/src/features/auth/auth-experience.tsx` (new): mode from the URL, the switch, the shared email and role, focus on the new heading, `document.title`.
- `apps/web/src/features/auth/flowing-light.tsx` (new): three SVG ribbon layers and soft washes, colours from `--orbit-blue`, `--orbit-violet` and `--orbit-cyan`, ids from `useId`.
- `auth-showcase.tsx`: `AuthPanel` (sign-in and sign-up copy stacked and cross-fading) and the phone strip. The atom is gone. The copy and keys are unchanged.
- `auth-screen.tsx`: `AuthTopBar`, `AuthColumn`, and `AuthScreen`, now only used by forgot and reset password (panel fixed on the left, same look).
- `login-form.tsx`, `signup-form.tsx`: form bodies without their own screen wrapper. Email (and role) are lifted into `AuthExperience`, so a typed email carries over. Other changes: a synchronous double-submit guard (`useRef`), headings with ids for focus, `maxLength` matching the shared Zod limits (name 80, center 120, email 200), and email input hints. Hover and pressed states on the role cards.
- `field.tsx`: errors with an icon and a soft rise, `FormError`, and `SubmitButton` (spinner, `aria-busy`, disabled while busy).
- `faroz-site.css`: the atom glow and `.fz-auth-swap` view-transition rules are replaced by the "Sign-in / sign-up" block (layout, slide, copy cross-fade, ribbons, reduced motion).
- Pages `login` and `signup` render `AuthExperience`. Comments in the `(auth)` layout and `[locale]/template.tsx` are updated.
- No new message keys, packages, API or contract changes.

## Verification

- `pnpm --filter @nuvora/web lint`: pass. `typecheck` (`next typegen` + `tsc`): pass. `test`: 7/7 pass (i18n key parity included). `build`: pass.
- Browser (built-in pane, dev server on :3000 with the API on :4000):
  - 1440×900, dark, ru: sign-in → sign-up → sign-in. Sampled frame by frame: the panel moved 720 → 0 px over about 640 ms after the commit, the forms and panel copy cross-faded during the move, and the front ribbon layer eased from 8% to 0. The URL, `document.title` and focus (the new `h1`) followed. Back and forward re-ran the slide. No horizontal overflow. Sign-in and sign-up fit at 900 px.
  - en, sign-up: teacher and center roles. Empty submit showed all field errors (center with every error: about 80 px of scroll at 900 px tall).
  - tg, light theme: sign-in.
  - 1024×768: split screen works. Sign-up scrolls a little.
  - 390×844 (light) and 375×812 (dark): brand strip plus form, switch to sign-up, no horizontal overflow.
  - 375 px, en: wrong password. The button shows a spinner, "Please wait…", `aria-busy` and is disabled. Three rapid clicks sent exactly one `POST /api/v1/auth/login` (401). "Wrong email or password." is announced.
  - Forgot password page renders with the new panel. `/start` (Try the demo) loads unchanged.
- Not checked: `prefers-reduced-motion` could not be emulated in the pane, so only the CSS rules were read back from the page. The "system" theme is not checked because the site has no system option (`enableSystem={false}`, dark by default, sun/moon toggle per the handoff). Not run: a successful sign-in with role redirect, two-factor, registration that creates an account, and demo sign-in, to avoid writing accounts or changing the pane's session.
- `prettier --check` flags these files, but it flags untouched files in `features/auth` the same way (working-copy line endings), so formatting was left as is.

## Known limitations and follow-ups

- On a 768 px-tall screen, sign-up with the Center role and every error showing scrolls slightly.
- The Next.js dev indicator covers the theme button at phone widths in dev only. Production has no indicator.
- Run reduced motion on a real browser setting, and a full sign-in, sign-up, two-factor and demo pass before the defense.

## Update 2026-11-01: homepage "How it works" made calmer

The owner's teacher said the "How it works" panels (Amina's skill scan, Arrays before and after) looked AI-generated. The cause was the visual pattern: every value sat in its own neon-outlined, tinted, heavily rounded box, the same colour repeated in border, fill, number and label, and the active tab had a filled mint icon. The data and copy are unchanged (handoff demo numbers).

- `apps/web/src/app/[locale]/(site)/page.tsx`: the skill scan is a plain per-topic report: topic, status with a small dot, a thin bar, and the score in tabular numbers. Colour appears only in the dot and the bar. The pattern note is text with a magenta left rule instead of a magenta box. Before and after is two bars on one scale (diagnostic in a neutral grey, retest in mint) with the scores in plain text, and the note below a divider. The bars use the existing `.fz-bar-grow` CSS animation: `GrowBar` (scroll-triggered) stayed at width 0 when a tab was opened while already on screen.
- `apps/web/src/features/home/learning-loop.tsx`: tabs are quieter (neutral icon tile, step number in a faint colour, inactive tabs without border or track). Only the open step shows a thin line, and it fills over the 5 s autoplay (`.fz-loop-timer` in `faroz-site.css`, off under reduced motion). The panel radius is 20 px instead of 24 px, and the columns stretch to the same height.
- Checked: `lint`, `typecheck`, `test` (7/7), `build` pass. Browser: 1440×900 dark (ru, en) and light (ru), 390×844 light (ru, no horizontal overflow). The scan and quest panels were not changed.
- This departs from the handoff's tile design for these two panels; the owner asked for it.

## Update 2026-11-01: waking the sleeping API

After the push, signing in on Render showed "Faroz can't reach its server". The free API had been asleep: the first request to `https://faroz-api.onrender.com/api/v1/plans` took 64 s, so the sign-in request failed, while later requests answered in under a second.

- `apps/web/src/components/wake-api.tsx` (new): pings `/api/v1/health` (the same health check Render uses) when a public page opens, at most once per 10 minutes of browsing. Fire and forget, nothing shown. Rendered in the `(site)` layout (home, `/start` and the rest of the site) and the `(auth)` layout (sign-in, sign-up, password reset).
- `docs/engineering/DEPLOYMENT.md`: the free-plan section mentions it.
- Checked: `lint`, `typecheck`, `test` (7/7), `build` pass. On local `/ru/login` the browser sent exactly one `GET /api/v1/health` (200), with no console errors. Not checked on Render yet: it needs a push and the API asleep again.
- Limit: a sign-in sent within the first minute of a cold start can still fail. Opening the site a few minutes before the defense is still the safe path.
