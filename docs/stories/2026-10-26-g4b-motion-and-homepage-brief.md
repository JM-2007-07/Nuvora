# 2026-10-26: G4-B preparation: D-22 approved, Motion installed, homepage brief

Status: **implemented and verified** (install, checks, docs). The homepage redesign is **planned**, not started.
Gate: G4-B   Decisions: D-22 (approved by the owner, 2026-10-26)

## Context

The owner approved D-22 (the homepage visual direction) and installing Motion for React, on condition of compatibility checks, a research brief, and an animation plan before any redesign.

## Decisions

- D-22 moved from Proposed to **Approved**: the direction plus `motion`. Canvas 2D and Three.js / React Three Fiber / Drei stay conditional on a justified, tested need (3D also needs another owner OK). GSAP and other animation frameworks are not used.
- **`motion@14.6.0`, pinned exactly.** It is the latest release. The 14.0 changelog lists only the removal of internal compatibility APIs, nothing public. Peer range is React `^18 || ^19`; the docs require React ≥ 18.2 and support Next.js App Router via `"use client"` or `motion/react-client`. MIT licence, no install scripts. 13.5.1 was the older alternative; it wasn't needed.
- The colour correction stays a proposal: it adds named brand primitives, which is a brand-palette change for the owner.

## Changes

- `apps/web/package.json`: `"motion": "14.6.0"`. `pnpm-lock.yaml`: additions only (`motion`, `framer-motion`, `motion-dom`, `motion-utils`, all 14.6.0; `tslib` 2.8.1 was already present). No existing entry changed or removed.
- Docs: `docs/01-architecture/decisions.md` (D-22 approved), `docs/engineering/HOMEPAGE_BRIEF.md` (new: 7 references, animation plan, colour audit and proposal, review findings), `docs/engineering/VISUAL_EXPERIENCE.md`, `docs/engineering/VERIFICATION.md` (API rebuild pitfall), `docs/engineering/HARNESS.md` (agent verification), `docs/05-planning/roadmap.md`, `docs/README.md`, `AGENTS.md` (toolchain row), `CLAUDE.md`, `.claude/skills/design-review/SKILL.md`.
- No application source changed. No database, schema, or `.env` access.

## Verification

| Check | Result |
| --- | --- |
| Motion types | Temporary file importing `LazyMotion`, `MotionConfig`, `domAnimation`, `useReducedMotion` from `motion/react` and `m` from `motion/react-m`; `tsc --noEmit` in `apps/web` → pass; file removed |
| Motion runtime import | `import('motion/react')` in Node from `apps/web` → pass |
| `pnpm lint` | pass |
| `pnpm typecheck` | pass |
| `pnpm build` | pass (web compiled; api built) |
| Production preview | `web-prod` restarted on the new build; `/tg` renders headline, knowledge-core SVG, 12 topic links, no horizontal scroll, empty console. Later: `/en` ×6, `/tg`, `/ru` → HTTP 200. No hot reload: rebuild after changes |
| Playwright smoke | `pnpm --filter @nuvora/web test:e2e` → **1 passed (8.2 s)** on Edge, against the `next dev` server already running on :3000. Assertions unchanged |
| Agents | All four launched and finished a bounded read-only task (`architect`: colour-fix plan; `quality-reviewer`: Motion install review, 1 minor finding fixed; `implementer`: `seed:check` and pinned counts, match; `visual-reviewer`: homepage at 375 px and a 746 px pane). Self-reported models: architect Opus 5.5, others Sonnet 5.5, matching the definitions. **Not independently confirmed**: the task output files were empty, so no model metadata was available |
| Not run | `pnpm test` (no code change since this morning's pass); Lighthouse; a true ≥1280 px desktop view |

## Known limitations and follow-ups

- **Intermittent 500 seen by the visual reviewer** on `/en`: the web server logged `fetch failed` / `ECONNREFUSED :4000`. Cause: `nest build` (from `pnpm build` and the implementer's `seed:check`) cleaned `apps/api/dist` under the running API watcher, which crashed until it restarted. Not caused by Motion. The homepage has no graceful error state for an unavailable API: G4-B follow-up.
- Review findings for G4-B: core below the first viewport, faint node focus outline, ~30 px node touch targets (see HOMEPAGE_BRIEF.md).
- Owner decision needed: the eight proposed brand primitives (or the fewer-token alternative).
- The reference board needs the designer to open and confirm the four unchecked references.
- Next step: apply the token correction (after the owner's decision), then build the hero entrance and mobile composition per the animation plan.

## Update 2026-10-26: colour tokens

Status: **implemented and verified.** The owner approved adding eight tokens with the exact existing values.

**Changes**

- `assets/brand/tokens.css` (source) and its copy `apps/web/src/styles/brand-tokens.css` (identical, D-16): eight brand primitives, `--nv-symbol-violet`, `--nv-symbol-lavender`, `--nv-accent-cyan`, `--nv-core-glow`, `--nv-core-depth`, `--nv-space-surface`, `--nv-space-text-lead`, `--nv-space-text-subtle`. The two gradient tokens now reference the stop tokens.
- `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/features/home/knowledge-core.tsx`: all 30 hard-coded values replaced (`bg-(--nv-…)`-style classes; SVG colours through the `style` property). Mapping: [HOMEPAGE_BRIEF.md](../engineering/HOMEPAGE_BRIEF.md#hard-coded-colours-applied-2026-10-26).
- Docs: `BRAND_GUIDELINES.md` (brand-space table), `design-system.md` (brand-space rule and how to write it), `VISUAL_EXPERIENCE.md` (gap 1 closed), `HOMEPAGE_BRIEF.md`.

**Verification**

| Check | Result |
| --- | --- |
| Remaining colours | 0 hex/`rgb(a)` matches in both files and in all of `apps/web/src` (excluding the token file) |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | pass / pass / pass |
| No visual change | Computed colours of the hero, arc, eyebrow, lead, tagline, both CTAs, all 10 SVG gradient stops, orbit/core/node strokes and fills, and the node chip were recorded on the old build and compared on the new one. All identical except three values whose colour space changed (`lab` → `oklab`/`srgb` for the arc border, arc shadow, and chip background). Painted over navy on a canvas, before and after give identical RGB (69,62,161 / 65,59,149 / 17,25,42) |
| Themes, locales, width | Fresh tab: `/tg`, `/ru`, `/en` in dark at 746 px and in light at 375 px. Hero stays `rgb(11,18,32)` in light theme, `<html lang>` correct, no horizontal overflow, **no console messages**. A true ≥ 1280 px desktop was not available in the pane |
| Playwright smoke | `pnpm --filter @nuvora/web test:e2e` → 1 passed (6.4 s), on the `next dev` server on :3000 |
| Not run | `pnpm test` (no logic change); Lighthouse |

**Notes**

- Console errors (a 500 and React error #441) seen in an older tab came from loads during this morning's API outage; the new server logged no errors and a fresh tab showed none.
- A 375 px light-theme screenshot looked faded because the `nv-rise` entrance animation was frozen at its first frame in the emulated pane. Not caused by the tokens; recorded as a G4-B finding in the brief.
