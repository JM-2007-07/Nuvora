# Visual experience: the Nuvora homepage and brand surfaces

Status: **Approved direction** (D-22, owner, 2026-10-26). The direction is a **required G4 deliverable** ([roadmap G4-B](../05-planning/roadmap.md#g4-user-facing-mvp)). Of the libraries in [Dependency plan](#dependency-plan), only Motion for React is approved for installation; everything else stays conditional on a justified, tested need and, for 3D, a further owner OK.

This document is the visual contract for the homepage and other brand surfaces. It sits on top of [BRAND_GUIDELINES.md](../02-design/BRAND_GUIDELINES.md) (logo, colours, type) and [design-system.md](../02-design/design-system.md) (tokens, components, UI motion). It doesn't repeat them. Where this document allows more motion than design-system.md, the exception applies to the homepage hero and the knowledge visualization only.

## Identity

Nuvora is an original educational product, not a generic LMS and not a page of default shadcn cards. **"Discover more. Become more."**

The homepage should feel like entering a premium, calm, intelligent universe of knowledge: deep space, a luminous centre, and fields of knowledge connected by light. It must feel designed for Nuvora specifically.

It must **not** look like: a generic AI landing page, a crypto dashboard, a gaming HUD, a random set of floating 3D objects, or a grid of identical course cards.

| Brand primitive | Value | Use on brand surfaces |
| --- | --- | --- |
| Deep Navy | `#0B1220` | The space itself: hero background in **both** themes |
| Violet | `#7C3AED` | Primary action, the core's inner light (restrained) |
| Teal | `#00E5C2` | Discovery accents: the spark, active connections, mastery |
| Cool Gray | `#94A3B8` | Secondary text and fine lines on navy |
| Inter | 400/500/600 | All interface text in tg, ru, en |
| Poppins | 400 (tagline), 600 (Latin display only) | Tagline and optional Latin display text. No Cyrillic glyphs |

All colours come from `assets/brand/tokens.css` via `--nv-*` tokens. If the hero needs a new colour (for example a glow stop), add a named token there first ([design-system.md](../02-design/design-system.md#theme-tokens)).

## Where we are (checked 2026-10-26)

A first pass of the homepage exists in the uncommitted G4 work:

- `apps/web/src/app/[locale]/page.tsx`: navy hero with headline, lead, two CTAs and the tagline; a six-step "learning loop" path; a prerequisite flow of the subject's topics.
- `apps/web/src/features/home/knowledge-core.tsx`: server-rendered SVG. The brand spark in a glowing core, the subject's **real topics** on an orbit as links, real prerequisite edges curving through the core. CSS-only motion (`.nv-*` in `globals.css`), off under reduced motion. No client JS.

Gaps against this contract (to fix in G4-B, not now):

1. ~~Hard-coded hex values in the hero and core~~: replaced with tokens on 2026-10-26, no visual change ([story](../stories/2026-10-26-g4b-motion-and-homepage-brief.md#update-2026-10-26-colour-tokens)).
2. One subject only, so "connected subject nodes" are topic nodes today. The design must work for 1 subject now and several later.
3. No depth layering, particles, parallax, or staged entrance beyond a CSS rise.
4. No imagery or texture. Sections below the hero are plain.
5. ~~Motion for React not installed~~: `motion` 14.6.0 installed 2026-10-26, not used yet.
6. Not yet reviewed at tablet width, in all locales, or with a performance measurement.

## The concept: the luminous knowledge core

The visual centrepiece is a **luminous knowledge core**: a spatial composition that stands for learning and discovery.

- **The core.** A soft, glowing centre built from the logo's four-point spark. Violet inner light, a teal spark, layered halos. It is the brightest point on the page and the first thing the eye finds.
- **Connected nodes.** Subjects (today: the Informatics topics) sit around the core on orbits at different depths. Fine glowing lines connect them along **real prerequisite relationships** from the API, never decorative random links.
- **Atmosphere.** Deep navy with layered radial gradients, a faint starfield or particle dust, and a horizon-like arc of light (echoing "a new horizon"). Violet and teal stay restrained: accents, not floodlights.
- **Depth.** Two or three planes (background haze, orbit plane, foreground nodes) with subtle parallax on pointer movement or scroll where it helps.
- **Motion with purpose.** A staged entrance (core lights up → orbits draw → nodes arrive → connections glow), then a slow idle drift. Hover or focus on a node brightens its connections and shows its title. Nothing loops fast, flashes, or competes with reading.
- **Meaning.** The visualization explains the product: knowledge is connected, and Nuvora shows you the path. If an effect doesn't serve that, cut it.
- **Static strength.** With all motion off, the composition is still striking: a finished poster, not a broken animation.

### Mobile

Mobile is composed, not shrunk. Below `md` the core moves above the headline as a smaller, cropped composition (core plus a partial orbit with 3–4 visible nodes), particle count drops, parallax is off, and touch targets for nodes are at least 44 px. Text never overlaps the visualization.

## Homepage structure

Sections are a proposal for G4-B. Each one uses data and features the backend actually has. Anything marked *later* is not built and must not be implied as available.

| # | Section | Content and real data | Notes |
| --- | --- | --- | --- |
| 1 | **Hero** | Headline, one-sentence lead, primary CTA "Start learning" → subject, secondary "My progress", tagline. Knowledge core with the subject's topics and prerequisites (`GET /subjects`, `GET /subjects/:slug`) | The only section with the full visualization |
| 2 | **Discover the connections** | The subject's topic graph as an explorable path (prerequisite edges, topic order), each node linking to its topic page. With a learner session, nodes show mastery status (`GET /me/progress`) | Grows into the Knowledge Map (FR-MAP). One subject today; designed for more *later* |
| 3 | **From understanding to practice** | The loop as one connected path: read a lesson → take a quiz → see weak topics → review the recommended lesson or book → track progress | Replaces generic "features" cards |
| 4 | **Mastery you can see** | A real example of mastery states (not started / developing / mastered / weak) with icon + label, and a sample recommendation ("Prerequisite for Loops") | Uses the ADR-0004 rules; demo data, clearly an example |
| 5 | **Inside a lesson** | An integrated preview: a slice of a real lesson with a Python code block, a quiz question with its explanation *after* answering, a recommended book | Composed as one editorial spread, not three cards |
| 6 | **Final call to action + footer** | One clear CTA, language and theme switchers, tagline, logo | Calm close; no link farm |

## Motion and 3D: stack evaluation

The goal is the intended quality with the fewest moving parts. Sizes are rough minified+gzipped figures from the libraries' published builds; measure in our build before deciding.

| Option | Good for | Cost (approx.) | Next.js 16 / React 19 | Accessibility & fallback | Verdict |
| --- | --- | --- | --- | --- | --- |
| **CSS** (gradients, masks, transforms, `@keyframes`) | Atmosphere, glows, idle drift, entrance of static layers | 0 KB JS | Native, works in Server Components | Easy to switch off with `prefers-reduced-motion` | **Use** for atmosphere and idle motion |
| **SVG** (server-rendered) | The core, orbits, nodes, connection lines, the graph | 0 KB JS | Native | Real links and text, screen-reader friendly | **Use** as the base and the no-JS/no-WebGL fallback (already exists) |
| **Motion for React** (`motion`) | Interface transitions, staged entrance, scroll-linked reveals, hover/focus states, quiz/result transitions | ~5 KB with `LazyMotion` + `m`, ~30+ KB full | Client Components; supports React 19 | `useReducedMotion` built in | **Use** (already approved in D-01, not yet installed) |
| **Canvas 2D** (hand-written) | Particle dust, a few hundred points | 0 KB library, a small module | Client-only | Easy to pause and to skip on low power | **Use** for particles if CSS isn't enough |
| **Three.js + React Three Fiber + Drei** | A true 3D core: real depth, lighting, bloom, camera moves | three ~150+ KB, R3F ~40 KB, Drei per-import (some helpers are large) | Client-only, `next/dynamic` with `ssr: false`; R3F 9 targets React 19 | Needs a full fallback (the SVG version) and its own reduced-motion and low-power paths | **Optional, gated.** Only if a prototype shows the SVG/CSS/Canvas core can't reach the intended depth |
| **GSAP** | Long, complex timelines | ~25+ KB core, plugins extra | Works client-side | Manual reduced-motion handling | **Don't add.** Motion covers the timelines we need. Revisit only with a documented gap |

### Who owns what

One system per job, so animations never fight each other:

| Responsibility | Owner |
| --- | --- |
| Static composition, core, nodes, lines, links | SVG (Server Component) |
| Atmosphere (gradients, haze, horizon arc), idle drift | CSS |
| Entrance staging, scroll reveals, hover/focus emphasis, page and quiz transitions | Motion for React |
| Particle dust | CSS (first) or Canvas 2D |
| True 3D depth, lighting, camera (only if approved) | React Three Fiber, rendering the same node and edge data as the SVG |

### Rules for a future 3D scene

- **Client boundary.** The scene is a Client Component loaded with `next/dynamic(..., { ssr: false })` from a small wrapper. The SVG core renders on the server first and stays in place until the scene is ready, then cross-fades. Server Components never import `three`.
- **Data.** The scene receives the same `topics` and edges as the SVG version. No separate content source.
- **Loading, fallback, errors.** While loading: the SVG core (no spinner on the hero). On WebGL unavailable, context loss, or an error boundary hit: stay on the SVG core silently. Log nothing to the console in normal operation.
- **Responsive camera.** Fit the composition to the container aspect ratio. Fewer nodes visible and a closer camera on narrow screens. Never letterbox text.
- **Interaction.** Pointer and touch move the parallax slightly. Every node also exists as a real focusable link (in the SVG layer or an accessible overlay) with the same order as the topic list, so keyboard and screen-reader users get the full function without the canvas.
- **Budget.** Cap device pixel ratio at 2 (1.5 on mobile), use instanced meshes for nodes and particles, no post-processing on mobile, render on demand (`frameloop="demand"`) when idle, pause when the tab is hidden or the hero is off-screen.
- **Reduced motion and low power.** `prefers-reduced-motion`, `navigator.connection.saveData`, or a slow first frame → render one static frame (or stay on SVG). No autoplay camera moves.
- **Mobile.** Default to the SVG/CSS version below `md` unless measurements show the scene is cheap enough.
- **Measure before and after.** Lighthouse mobile on a production build (Performance ≥ 85 target from [quality-standards](../06-quality/quality-standards.md#performance)), JS shipped for `/[locale]`, LCP, and GPU frame time on the demo laptop. Record the numbers in the story.

## Imagery and assets

Imagery is used only where it improves the experience, with one cohesive art direction.

**Allowed sources**

- **Pinterest:** mood boards and inspiration only. Never a source of downloadable or reusable images.
- **Unsplash, Pexels, Pixabay** or other reputable libraries: only after reading that asset's licence and noting the conditions. Avoid images with recognizable people or brands unless the licence and context clearly allow it.
- **Generated images:** when a suitable tool is available, with the tool and prompt recorded.
- **Custom SVG, CSS, Canvas, or 3D-made assets** for abstract elements (preferred for the core and its atmosphere).

**Record for every major asset** (in `assets/visual/SOURCES.md` when the first asset is added): file, source URL or tool, author, licence or usage terms, attribution text if required, date retrieved, and where it is used.

**Integration**

- Match lighting, palette (navy, violet, teal), contrast, and crop to the page. Grade photos towards the palette rather than dropping them in as they are.
- No watermarks, no unrelated stock scenes, no mixed illustration styles, no decorative assets that make the page feel like a template.

**For each asset decide:** why it belongs · where and at which breakpoints · responsive crops and aspect ratios · format (AVIF/WebP via `next/image`, SVG for vector) · lazy loading (everything below the hero) · alt text, or `alt=""` when decorative · contrast behind any text on top (overlay or scrim, measured) · placeholder (blur or solid navy) and failure fallback.

## References

Use as inspiration, never to copy. Gather a short, focused board (5–8 items) at the start of G4-B and record what is useful about each and how it adapts to Nuvora. Look for: interactive knowledge maps and graph explorers, restrained 3D product heroes with a single focal object, editorial typography with generous space, and calm premium education interfaces. No live reference research was done for this document (2026-10-26); the board is the first G4-B task.

## Design brief (G4-B)

- **Objective:** a homepage that a first-time visitor remembers, that explains Nuvora in one look (connected knowledge, a path to mastery), and that gets them into a lesson in one click.
- **Audience:** students and self-learners, often on phones, reading Tajik, Russian, or English.
- **Tone:** premium, calm, intelligent, optimistic. Light used like a planetarium, not a nightclub.
- **Must have:** the knowledge core with real topic data, a clear headline and CTA in all three languages, the loop and mastery explained through the product's real behaviour, strong static fallback, mobile composition, reduced-motion path, keyboard access.
- **Must not:** generic card grids, fake features, stock clichés (lightbulbs, graduation caps, people pointing at laptops), more than one animation system per job, text over busy imagery without a measured scrim.
- **If time runs short:** cut secondary decoration (particles, parallax, imagery in lower sections, the 3D upgrade) before the hero's identity or the learning loop.

## Implementation checklist (G4-B)

1. Reference board (5–8 items) recorded here; owner agrees on direction.
2. ~~Owner decides D-22~~: approved 2026-10-26 (direction + Motion). Research brief and animation plan: [HOMEPAGE_BRIEF.md](HOMEPAGE_BRIEF.md).
3. ~~Replace hard-coded hex values with `--nv-*` tokens~~: done 2026-10-26.
4. Build the hero composition on the existing SVG core: depth layers, atmosphere, staged entrance, idle drift, node hover/focus.
5. Mobile composition (separate layout below `md`, not a scaled desktop).
6. Sections 2–6 with real data and translated copy in tg/ru/en; Tajik marked for review.
7. Imagery only where it earns its place, with `assets/visual/SOURCES.md`.
8. Optional: 3D upgrade behind `next/dynamic`, only after a prototype and a measurement.
9. Verify with `visual-qa` and `design-review`: three viewports × three locales × two themes, reduced motion, keyboard, console, Lighthouse mobile; record numbers in the story.

## Dependency plan

| Package | Status | Why | When |
| --- | --- | --- | --- |
| `motion` (Motion for React) | **Installed** 14.6.0 (2026-10-26, D-22) | Entrance staging, transitions, reduced-motion hook | Now; first use in G4-B |
| `three`, `@react-three/fiber`, `@react-three/drei` | **Optional**, needs a prototype, a measurement, and a further owner OK (D-22) | True 3D core, only if the SVG/CSS/Canvas prototype falls short | After a prototype and measurement |
| `@react-three/postprocessing` | **Optional, desktop only** | Bloom on the core | Only with the 3D option, and only if the budget allows |
| `gsap` | **Not needed** | Motion covers our timelines; two animation systems would overlap | — |
| `lottie-web`, `tsparticles`, other effect bundles | **Not needed** | CSS/Canvas cover particles; Lottie adds a second art pipeline | — |

Only `motion` is installed (2026-10-26). Research brief, animation plan, colour audit, and first review findings: [HOMEPAGE_BRIEF.md](HOMEPAGE_BRIEF.md).
