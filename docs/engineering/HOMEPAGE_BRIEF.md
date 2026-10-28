# Homepage research brief and animation plan (G4-B)

Status: **Draft for review** (2026-10-26). Implements step 1 of the [G4-B implementation checklist](VISUAL_EXPERIENCE.md#implementation-checklist-g4-b). The contract it serves is [VISUAL_EXPERIENCE.md](VISUAL_EXPERIENCE.md) (D-22, approved). Nothing here is implemented yet.

The concept stays fixed: a **luminous knowledge core** with connected subject/topic nodes from real prerequisite data, restrained violet and teal light on deep navy, atmospheric depth, purposeful motion, integrated imagery, and a distinctive responsive layout. Not a card grid.

## References

Inspiration, not designs to copy. "Checked" means a web search on 2026-10-26 confirmed the described trait from a secondary source; the other entries come from prior knowledge and should be opened and confirmed by the designer before the board is final. None was inspected in a browser in this session.

| # | Reference | Useful because | How it adapts to Nuvora | Checked |
| --- | --- | --- | --- | --- |
| 1 | **Stripe homepage**: animated WebGL gradient "ribbon" | One signature motion element, tuned for a year (blur, grain, colour), carries the brand; everything else is calm | The core's halo and the horizon arc get the same care: one signature light, grain to avoid banding, everything else quiet. We use CSS/SVG first, not a shader | Yes ([leerob.io](https://archive.leerob.io/blog/how-stripe-designs-beautiful-websites)) |
| 2 | **Linear website**: dark interface, precise type, fast-loading animation | Proves dark + restraint reads as premium; typography and spacing do most of the work | Navy hero with Inter at a strict scale; motion never delays content; no glow on body text | Yes ([critique](https://anthonyhobday.com/blog/20230119.html), [uxpin](https://www.uxpin.com/studio/blog/good-website-designs-examples/)) |
| 3 | **Awwwards "3D hero" inspiration entries** (e.g. glow-tagged hero pieces) and 2026 winner commentary | Winners commit to one strong visual moment, and performance on mid-range phones is judged | One focal object (the core), one or two moments (entrance, node focus). Mobile budget is a requirement, not polish | Partly: trend sources only ([Awwwards](https://www.awwwards.com/inspiration/3d-hero-josh-warren), [hontran.dev](https://www.hontran.dev/blog/best-award-winning-websites-2026)) |
| 4 | **Map of Mathematics** (Dominic Walliman's illustrated map) | Shows a whole field as connected regions you can read at a glance | Node labels and grouping must be legible as a map, not as decoration; later subjects become regions around the core | No |
| 5 | **Obsidian graph view** | Nodes and links that brighten on hover make relationships tangible | Hover/focus on a node lights its prerequisite edges and dims the rest; same data drives a keyboard-accessible list | No |
| 6 | **NASA "Eyes on the Solar System"** | A calm orbital system with depth and a planetarium feel; lighting suggests scale | Orbits at two or three depths, slow drift, light from the centre outward. A reference for mood, not for 3D scope | No |
| 7 | **Kurzgesagt** art direction | A deep-navy, luminous, flat-with-glow style that stays readable and friendly for learners | Possible style for lower-section illustrations, if any are made: same palette, soft glows, no realism mismatch | No |

The web searches returned no usable result for Brilliant.org or for generic knowledge-graph sites, so they are not on the board.

## Animation plan

One owner per job (VISUAL_EXPERIENCE.md "Who owns what"). Motion is used through `LazyMotion` + `m` (`motion/react-m`, `domAnimation` features) inside one client component, so the server-rendered SVG stays the source of the composition. All timings are starting values to tune in the browser.

### Hero entrance (first load only)

| Step | t (ms) | What | Owner | Reduced motion |
| --- | --- | --- | --- | --- |
| 1 | 0–400 | Navy atmosphere and horizon arc fade in (opacity) | CSS | Shown immediately |
| 2 | 150–700 | Core: halo scales 0.92 → 1 and brightens; spark rotates in by 45° | Motion (`m.g`, transform + opacity) | Shown immediately |
| 3 | 400–1100 | Orbits draw (stroke-dashoffset on the orbit circles) | CSS on SVG | Fully drawn |
| 4 | 600–1300 | Nodes arrive in topic order, 60 ms stagger, from the core outward (translate along the radius + opacity) | Motion (`staggerChildren`) | In place, no movement |
| 5 | 900–1500 | Prerequisite edges brighten in order (opacity) | Motion | Visible |
| 6 | 200–800 | Headline, lead, and CTAs rise 8 px + fade, 80 ms stagger | Motion | Visible, no rise |

Total under 1.5 s. Content is in the HTML from the start, so the LCP element (the headline) is never waiting for JavaScript; the entrance only animates `transform`/`opacity` from a visible fallback.

### Idle and interaction

- **Idle drift:** each orbit rotates very slowly (one turn in 120–180 s) in alternating directions; node labels stay upright. CSS `@keyframes`, paused when the hero is off-screen (`IntersectionObserver` toggling a class) and under reduced motion.
- **Node hover/focus:** the node scales to 1.06, its edges to and from prerequisites brighten to full teal, others dim to 40%. 150 ms ease-out. Driven by the same state for pointer and keyboard focus (Motion `whileHover`/`whileFocus` or a shared CSS class).
- **Pointer parallax (desktop only):** background haze and orbit plane shift by at most 8 px and 4 px against the pointer (`useMotionValue` + `useSpring` with low stiffness). Off on touch devices, below `md`, and under reduced motion.
- **Scroll:** sections below the hero reveal once (opacity + 12 px rise, `whileInView`, `once: true`). No scroll-jacking, no pinned scroll scenes.

### Reduced motion and fallbacks

- `MotionConfig reducedMotion="user"` at the homepage root: transform animations off, opacity kept. `useReducedMotion()` disables parallax and idle drift explicitly.
- Without JavaScript the page is the finished static composition (server SVG + CSS), including links on every node.
- The 3D option stays out of scope until a prototype justifies it (D-22).

### Mobile (< `md`)

- Core above the headline, cropped, 3–4 visible nodes on a partial orbit; full list of topics stays as links below.
- Entrance shortened to under 900 ms; no parallax; idle drift slower or off; edges thinner to keep it calm on small screens.
- Node hit areas ≥ 44 px even where the drawn node is smaller.

### Budget and measurement

- Added client JS for the homepage motion: target ≤ 15 KB gzipped (LazyMotion core plus `domAnimation`, which the docs put at about 5 KB plus 24 KB before compression of our code; measure the real number in the build output).
- Measure before and after on a production build: Lighthouse mobile (Performance ≥ 85, Accessibility ≥ 95), LCP, total JS for `/[locale]`, and a performance trace of the entrance on the demo laptop. Record the numbers in the G4-B story.

## Hard-coded colours: applied 2026-10-26

All 30 hard-coded values in `apps/web/src/app/[locale]/page.tsx` (11) and `apps/web/src/features/home/knowledge-core.tsx` (19) now reference tokens. Values are unchanged; no new colour was introduced. A search of `apps/web/src` finds no hex or `rgb(a)` colour outside the token file.

| Value | Count | Token | New? |
| --- | --- | --- | --- |
| `#0B1220` | 3 | `--nv-navy` | existing |
| `#7C3AED` / `#6D28D9` | 1 / 1 | `--nv-violet` / `--nv-violet-700` | existing |
| `#00E5C2` | 11 | `--nv-teal` | existing |
| `#A78BFA` | 2 | `--nv-violet-300` | existing |
| `#6D5CF6` (+ `rgba(109,92,246,0.55)`) | 3 + 1 | `--nv-symbol-violet` | new |
| `#C3B4FF` | 2 | `--nv-symbol-lavender` | new |
| `#22C3F0` | 1 | `--nv-accent-cyan` | new |
| `#2F5BE6` | 1 | `--nv-core-glow` | new |
| `#2F3FB0` | 1 | `--nv-core-depth` | new |
| `#121A2B` | 1 | `--nv-space-surface` | new |
| `#C9D2FF` | 1 | `--nv-space-text-lead` | new |
| `#A3AEC2` | 1 | `--nv-space-text-subtle` | new |

Why no semantic tokens: `#121A2B` and `#A3AEC2` equal the dark-theme `--nv-surface` and `--nv-text-muted`, but the hero is navy in both themes, and those semantic tokens turn light in the light theme. The names follow the existing layers: symbol and accent stops by origin, `--nv-core-*` and `--nv-space-*` by purpose. The two gradient tokens now reference the new stop tokens instead of repeating their hex values. Rules: [design-system.md](../02-design/design-system.md#theme-tokens), values: [BRAND_GUIDELINES.md](../02-design/BRAND_GUIDELINES.md#colour-palette).

## Findings from the first review (2026-10-26)

From the `visual-reviewer` agent (375 px and a 746 px pane, `en`, dark) plus a log check here. Inputs for G4-B, not yet fixed:

- **Core not in the first viewport:** it starts at about y 1330 at 375 px and y 580 at 746 px, below the text hero. Contradicts "first thing the eye finds". The mobile composition above addresses it.
- **Faint node focus:** core node outline is 1.6 px teal at 50% alpha; raise it to the CTA's strength and brighten the node's edges on focus.
- **Small touch targets:** core nodes are about 30 px high at 375 px; needs ≥ 44 px hit areas.
- **No error state when the API is down:** the homepage threw "fetch failed" (ECONNREFUSED to :4000) and showed Next.js's error screen. It happened because `nest build` (from `pnpm build` / `seed:check`) cleaned `apps/api/dist` under the running API watcher. The page should degrade to a translated message plus the static composition.
- Atmosphere and depth are thin (already listed in VISUAL_EXPERIENCE.md).
- **Hero text depends on a CSS animation to become visible:** `.nv-rise` uses fill mode `both`, so the text starts at opacity 0. In a throttled or frozen tab (seen in the browser pane at 375 px on 2026-10-26) it stays invisible. The entrance should animate from a visible state, or be applied only after hydration (see the animation plan).
