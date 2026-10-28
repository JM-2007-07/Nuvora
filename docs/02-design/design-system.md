# Design system

Status: **Approved** (G0 baseline, owner, 2026-10-25). This document is authoritative for UI-level design rules: semantic theme tokens, UI typography, layout, components, motion, and feature-specific visuals. Brand-level rules (logo, brand colours, brand type) are in [BRAND_GUIDELINES.md](BRAND_GUIDELINES.md). Don't repeat them here.

The homepage and other brand surfaces follow the visual contract in [VISUAL_EXPERIENCE.md](../engineering/VISUAL_EXPERIENCE.md) (Proposed), which builds on these rules.

## Theme tokens

The semantic tokens are defined in [`assets/brand/tokens.css`](../../assets/brand/tokens.css) (light on `:root`, dark on `.dark`). At scaffold time, map them to the variable names shadcn/ui expects, so generated components pick up the brand automatically:

| shadcn/ui variable | Nuvora token |
| --- | --- |
| `--background` | `--nv-bg` |
| `--foreground` | `--nv-text` |
| `--card`, `--popover` | `--nv-surface` |
| `--card-foreground`, `--popover-foreground` | `--nv-text` |
| `--primary` | `--nv-primary` |
| `--primary-foreground` | `--nv-on-primary` |
| `--secondary`, `--muted` | `--nv-surface-muted` |
| `--secondary-foreground` | `--nv-text` |
| `--muted-foreground` | `--nv-text-muted` |
| `--accent` | `--nv-accent` |
| `--accent-foreground` | `--nv-on-accent` |
| `--border`, `--input` | `--nv-border` |
| `--ring` | `--nv-focus-ring` |
| `--destructive` | `--nv-status-weak` (below) |

Rules:

- Components use Tailwind theme classes (`bg-background`, `text-primary`, …) or `--nv-*` tokens, **never raw hex values**.
- **Brand space exception:** the homepage hero and knowledge core are deep navy in **both** themes, so they use fixed brand primitives (`--nv-navy`, `--nv-violet`, `--nv-teal`, the symbol stops, and the `--nv-core-*` / `--nv-space-*` tokens in [BRAND_GUIDELINES](BRAND_GUIDELINES.md#colour-palette)), never semantic tokens such as `--nv-bg` or `--nv-surface`, which turn light in the light theme. In Tailwind write them as `bg-(--nv-navy)`, `text-(--nv-space-text-lead)`, `border-(--nv-symbol-violet)/60`. In SVG, set colours with the `style` property (`style={{ stopColor: 'var(--nv-teal)' }}`); `var()` in presentation attributes such as `stopColor="…"` isn't reliable.
- A new colour need means a new semantic token here, checked for contrast in both themes.

### Status colours

Used for quiz correctness and topic mastery. Always pair them with an icon and a text label (never colour alone). All values meet 4.5:1 against both theme backgrounds (measured).

| Token | Meaning | Light | Dark | Icon (suggestion) |
| --- | --- | --- | --- | --- |
| `--nv-status-weak` | Weak / incorrect | `#BE123C` | `#FB7185` | alert / ✕ |
| `--nv-status-developing` | Developing | `#B45309` | `#FBBF24` | half-filled circle |
| `--nv-status-mastered` | Mastered / correct | `#0F766E` | `#00E5C2` | check |
| `--nv-status-not-started` | Not started | `#475569` | `#A3AEC2` | empty circle |

These four tokens live in `assets/brand/tokens.css` (added at G1 scaffold time). They're UI-level, not brand colours.

## Typography (UI)

- **UI font: Inter** (D-07, Approved). Weights 400, 500, 600. Subsets `latin`, `cyrillic`, `cyrillic-ext` (Tajik letters are in `cyrillic-ext`, verified 2026-10-25).
- **Code font:** the system monospace stack (`ui-monospace, Consolas, "Cascadia Mono", Menlo, monospace`). These include Cyrillic, so translated code comments render correctly. No extra font download.
- **Code blocks** (Informatics lessons and questions): `--nv-surface-muted` background, 1px `--nv-border`, `0.5rem` radius, horizontal scroll inside the block (never the page), no syntax highlighting in the MVP (D-12). Code is always `lang="en"` and `dir="ltr"`.
- **Brand font:** Poppins only for the tagline and optional Latin-only display text ([brand guidelines](BRAND_GUIDELINES.md#typography)).
- Type scale (rem, based on a 16 px root): `0.875` small/meta · `1` body · `1.125` lead · `1.25` h4 · `1.5` h3 · `1.875` h2 · `2.25` h1 (≥ 768 px; `1.875` below).
- Body line height 1.6. Lessons are limited to about 70 characters per line. Russian and Tajik words run longer than English, so never size containers to fit English text.

## Layout and responsiveness

- Mobile-first. Must work from **360 px** wide. Breakpoints follow Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).
- App shell: header (logo, language switcher, theme switcher, "My progress"), main content, no sidebar in the MVP.
- Spacing on a 4 px grid (Tailwind spacing scale). Border radius: `0.75rem` for cards, `0.5rem` for inputs and buttons. The rounded geometry echoes the logo.
- Touch targets ≥ 44 × 44 px.

## Components (shadcn/ui, MVP set)

Generate only what the MVP pages use: `button`, `card`, `badge`, `progress`, `radio-group`, `dropdown-menu` (language and theme switchers), `separator`, `skeleton`, `tooltip`, `alert`. Each generated component becomes our code: adapt it to the tokens and don't fork the styles inline.

## Motion

Uses Motion for React (D-01; not installed yet, checked 2026-10-26). In the learning UI, motion should explain what changed, never decorate. The homepage hero and knowledge visualization may use atmospheric motion as described in [VISUAL_EXPERIENCE.md](../engineering/VISUAL_EXPERIENCE.md#motion-and-3d-stack-evaluation), with the same reduced-motion rule.

- Allowed: quiz question transitions (slide/fade ≤ 200 ms), results reveal (score count-up, staggered breakdown ≤ 400 ms total), map node focus/hover, page-level fade (≤ 150 ms).
- Easing: ease-out for entering, ease-in for leaving. No bounces or springs on content.
- Animate `transform` and `opacity` only.
- Respect `prefers-reduced-motion`: replace movement with an instant change or a simple fade.

## Knowledge Map

Plain SVG (D-09), drawn in the web app from API data:

- Nodes: rounded rectangles, positioned by `mapX`/`mapY` from the seed (a left-to-right layout, prerequisites on the left). Each node shows the topic title, a status icon, and a status label.
- Edges: arrows from prerequisite to dependent topic, `--nv-border` colour, highlighted when either end has focus.
- Interaction: each node is a link (focusable, Enter opens the topic). Tab order follows topic order.
- Small screens and screen readers: a **list view** of topics with prerequisites written out ("Requires: Fractions"). It's the same data, toggled by a "Map / List" switch, and is the default under `md`.
- Legend always visible: status colours + icons + labels.
