# Nuvora brand guidelines

Status: brand direction **Approved** (A-01). Vector assets and tokens v0.1 are **Approved** as the G0 baseline (owner, 2026-10-25).

This document is authoritative for the logo, brand colours, brand typography, and asset usage. UI-level rules (semantic theme tokens, components, motion) live in [design-system.md](design-system.md).

## Brand concept

**Nuvora: Discover more. Become more.**

Nuvora stands for *a new horizon of knowledge, learning, and personal growth*. The approved reference shows four values: **Knowledge, Growth, Innovation, Future**.

The symbol is a geometric letter **N** built from a folded ribbon:

- **Two stems and a diagonal band** form one continuous path, like a ribbon folding forward. Learning is a path that keeps moving.
- The **fold gaps** where the band crosses the stems give depth and a sense of layering. Knowledge builds on knowledge.
- The **four-point spark** above the N is discovery: the moment something clicks.
- The **gradient** runs from sky blue through violet to soft lavender on the band, and from teal down to blue on the right stem. It reads as moving from the familiar toward a new horizon.

Personality: premium, modern, technological, optimistic, calm.

## Source of truth

| Item | Location |
| --- | --- |
| Approved visual reference (raster) | [`nuvora-logo-concept.png.png`](../../nuvora-logo-concept.png.png). **Intended location: the repository root, under its original filename, unmodified.** It is not renamed, moved, re-exported, or replaced. It is currently untracked and should be included in the first Phase 0 commit so it is versioned |
| Production vector assets | [`assets/brand/`](../../assets/brand/) |
| Brand colour tokens (CSS) | [`assets/brand/tokens.css`](../../assets/brand/tokens.css) |

## Logo variations

All files are hand-built vector SVGs: real paths, a proper `viewBox`, a transparent background (except the favicon tile), no embedded raster images, and no filters.

| File | What it is | Use it for |
| --- | --- | --- |
| [`logo-full.svg`](../../assets/brand/logo-full.svg) | Symbol + "Nuvora" wordmark in Deep Navy | **Default logo on light backgrounds**: app header (light theme), documents, slides with light backgrounds |
| [`logo-full-dark.svg`](../../assets/brand/logo-full-dark.svg) | Symbol + wordmark in white→lavender | **Dark backgrounds**: app header (dark theme), dark slides, the presentation title slide |
| [`logo-symbol.svg`](../../assets/brand/logo-symbol.svg) | Gradient N + spark, no wordmark | Square or tight spaces where the name appears nearby: compact mobile header, loading state, avatars, social images |
| [`logo-symbol-mono.svg`](../../assets/brand/logo-symbol-mono.svg) | Single-colour N + spark (Deep Navy by default) | One-colour contexts: print, embossing, watermarks, very busy or photographic backgrounds, places where gradients are not allowed. Can be recoloured (see below) |
| [`favicon.svg`](../../assets/brand/favicon.svg) | Symbol on a Deep Navy rounded tile (app-icon style) | Browser tab icon and app icon. The tile keeps the mark visible on both light and dark browser chrome |
| [`source/logo-full-text.svg`](../../assets/brand/source/logo-full-text.svg) | Editing source: symbol + wordmark as **live text** (Poppins SemiBold) | Editing only, in Figma, Inkscape, or Illustrator. **Never ship it**: it renders in a fallback font wherever Poppins isn't installed |

### About the wordmark

The shipped wordmark is **drawn as vector geometry**, not live text. It's built from straight stems and circular bowls in the spirit of **Poppins SemiBold**. This means it looks identical everywhere, including in `<img>` tags, where web fonts never load. It is **not** an exact trace of Poppins's outlines (see [Limitations](#limitations-and-follow-ups)).

### Recolouring the mono symbol

`logo-symbol-mono.svg` uses `fill="currentColor"` with `color="#0B1220"` on the root element:

- Used as an `<img>`, it is always Deep Navy.
- Pasted inline as SVG/JSX, setting CSS `color` **on the `<svg>` element itself** recolours it (e.g. `className="text-white"`).

Allowed mono colours: Deep Navy `#0B1220`, white `#FFFFFF`, and Violet `#7C3AED` (on light backgrounds only).

## Colour palette

The four brand colours come from the approved reference swatches.

| Name | Hex | Role |
| --- | --- | --- |
| **Deep Navy** | `#0B1220` | Primary dark: wordmark on light, dark-theme background, favicon tile |
| **Violet** | `#7C3AED` | Primary action colour (buttons, links) in the light theme |
| **Teal** | `#00E5C2` | Accent: spark, highlights, success/mastery fills, focus ring in dark theme |
| **Cool Gray** | `#94A3B8` | Neutral: borders, secondary text **on dark backgrounds** |

Supporting shades (needed for accessible text and the dark theme):

| Name | Hex | Why it exists |
| --- | --- | --- |
| Violet 300 | `#A78BFA` | Violet that reads on Deep Navy (6.9:1) |
| Violet 700 | `#6D28D9` | Hover/pressed state for Violet on light |
| Teal 700 | `#0F766E` | Teal-coloured **text** on light backgrounds (5.2:1). Brand Teal is only 1.6:1 on white |

**Symbol gradient** (used only inside the logo, and sparingly for hero accents): `#6FB0FF → #6D5CF6 → #C3B4FF` at 135°. Accent gradient: `#00E5C2 → #22C3F0`. Three of these stops are also named tokens because the knowledge core uses them on their own: `--nv-symbol-violet` (#6D5CF6), `--nv-symbol-lavender` (#C3B4FF), `--nv-accent-cyan` (#22C3F0).

**Brand space** (added 2026-10-26, values taken unchanged from the homepage): fixed colours for the always-navy homepage hero and knowledge core. They don't change with the theme.

| Token | Hex | Use |
| --- | --- | --- |
| `--nv-core-glow` | `#2F5BE6` | Blue in the knowledge core's outer halo |
| `--nv-core-depth` | `#2F3FB0` | Shaded edge of the core sphere |
| `--nv-space-surface` | `#121A2B` | Node label chips on navy |
| `--nv-space-text-lead` | `#C9D2FF` | Hero lead text on navy (12.6:1) |
| `--nv-space-text-subtle` | `#A3AEC2` | Tagline and meta text on navy (8.4:1) |

### Contrast rules (WCAG 2.x, measured)

| Pairing | Ratio | Allowed for |
| --- | --- | --- |
| Deep Navy on white | 18.7:1 | All text |
| White on Violet | 5.7:1 | Button labels, all text |
| Violet on white | 5.7:1 | Links, all text |
| Deep Navy on Teal | 11.6:1 | Labels on teal fills |
| Teal on Deep Navy | 11.6:1 | All text in dark theme |
| Cool Gray on Deep Navy | 7.3:1 | Secondary text in dark theme |
| **Cool Gray on white** | **2.6:1** | ❌ Not for text. Borders and decoration only |
| **Teal on white** | **1.6:1** | ❌ Not for text or thin lines. Fills only, with Deep Navy text on top |

### CSS tokens

[`assets/brand/tokens.css`](../../assets/brand/tokens.css) defines two layers:

1. **Brand primitives** (`--nv-navy`, `--nv-violet`, `--nv-teal`, `--nv-gray`, shades, gradients). These never change with the theme.
2. **Semantic theme tokens** (`--nv-bg`, `--nv-surface`, `--nv-text`, `--nv-primary`, `--nv-accent`, …), with values for light (`:root`) and dark (`.dark`).

UI code uses only the semantic tokens. How they map to shadcn/ui and Tailwind is in [design-system.md](design-system.md#theme-tokens).

## Typography

| Use | Typeface | Weight | Notes |
| --- | --- | --- | --- |
| Wordmark | Custom vector construction in the spirit of Poppins SemiBold | — | Never retype the logo. Use the SVG files |
| Tagline "Discover more. Become more." | **Poppins** Regular | 400 | Letter spacing about +0.15em (reference: tracking +150). Latin only |
| Latin display headings (marketing, slides) | Poppins | 600 | Optional |
| **Interface text in all three languages** | **Inter** (D-07, Approved) | 400 / 500 / 600 | **Poppins has no Cyrillic glyphs**, so it can't render Russian or Tajik. Inter was checked on 2026-10-25 and renders all Tajik letters (Ғ ғ Ӣ ӣ Қ қ Ӯ ӯ Ҳ ҳ Ҷ ҷ) and Russian Cyrillic |

The tagline isn't baked into the logo files: at small sizes it becomes unreadable. Set it as live text below or beside the logo when needed. The brand name "Nuvora" is never translated or transliterated. It stays in Latin script in all locales. The tagline may be translated in the UI (translations to be approved by the content owner).

## Size and clear space

- **Clear space:** keep empty space around the logo of at least **X**, where X is the width of one stem of the N (about a quarter of the symbol's width). Don't place text, edges, or other graphics inside it.
- **Minimum sizes (on screen):**
  - Full logo: **100 px wide** (wordmark cap height about 13 px).
  - Symbol: **24 px**.
  - Below 24 px, use `favicon.svg` (16 px and 32 px are supported).
- **Print:** full logo at least 30 mm wide. Symbol at least 8 mm.

## Correct usage

- ✅ Use `logo-full.svg` on light surfaces and `logo-full-dark.svg` on dark surfaces.
- ✅ Scale proportionally (set width *or* height, not both with different ratios).
- ✅ Place on plain brand surfaces (white, `#F6F8FC`, Deep Navy) or calm, low-detail imagery.
- ✅ Use the mono symbol when only one colour is available.

## Incorrect usage

- ❌ Don't stretch, squash, rotate, or skew the logo.
- ❌ Don't recolour the gradient symbol or swap the gradient colours.
- ❌ Don't add shadows, outlines, glows, or bevels. The reference's glow belongs to the hero artwork, not to the logo itself.
- ❌ Don't retype the wordmark in another font, or change its letter spacing.
- ❌ Don't separate or rearrange the spark, stems, or band.
- ❌ Don't use the dark-text logo on dark backgrounds or the light-text logo on light backgrounds.
- ❌ Don't place the logo on busy images or on mid-tone backgrounds where it falls below 3:1 contrast.
- ❌ Don't put the logo inside a sentence or use it as a letter "N".

## Light and dark themes

| Context | Logo | Background |
| --- | --- | --- |
| Light theme | `logo-full.svg` | `--nv-bg` `#F6F8FC` or white |
| Dark theme | `logo-full-dark.svg` | `--nv-bg` `#0B1220` |
| Either (icon only) | `logo-symbol.svg` | The gradient symbol works on both |
| Browser tab | `favicon.svg` | Its own navy tile |

In the dark theme, the darker indigo at the top of the left stem has lower contrast against Deep Navy. That is intentional (it reads as the stem tucking behind the band). Don't lighten it.

## Using the assets in Next.js

No application code exists yet. This is the plan for scaffold time (D-16).

1. **Copy** `assets/brand/*.svg` into `apps/web/public/brand/`. `assets/brand/` stays the source of truth, so update there first, then copy.
2. **Favicon:** copy `favicon.svg` to `apps/web/src/app/icon.svg`. The App Router generates the `<link rel="icon">` automatically. Also add `apple-icon.png` (180×180) once a PNG export exists (see limitations).
3. **Tokens:** import `tokens.css` once in the root layout's global CSS, then map tokens as described in [design-system.md](design-system.md#theme-tokens).
4. **Logo component**: render both versions and let CSS pick, so there's no flash or hydration mismatch with next-themes:

```tsx
// apps/web/src/components/brand/logo.tsx (planned)
import Image from "next/image";

export function Logo({ width = 140 }: { width?: number }) {
  const height = Math.round((width * 109) / 364); // viewBox 364 × 109
  return (
    <>
      <Image src="/brand/logo-full.svg" alt="Nuvora" width={width} height={height} className="dark:hidden" priority />
      <Image src="/brand/logo-full-dark.svg" alt="Nuvora" width={width} height={height} className="hidden dark:block" priority />
    </>
  );
}
```

5. **Symbol-only:** `<Image src="/brand/logo-symbol.svg" alt="Nuvora" width={32} height={35} />` (viewBox 100 × 109).
6. **Inline/recolourable mono:** paste the paths from `logo-symbol-mono.svg` into a small React component. That way no SVGR loader is needed (no extra dependency).
7. **Fonts:** load Poppins (Latin, weight 400 for the tagline, plus 600 if used for display) and Inter (subsets `latin`, `cyrillic`, `cyrillic-ext`) with `next/font/google`, as CSS variables mapped to `--nv-font-brand` and `--nv-font-sans`. The logo never depends on either font.

## Limitations and follow-ups

- **Flat interpretation of a 3D reference.** The reference symbol is a glossy 3D ribbon with soft lighting. The SVGs reproduce its geometry, fold gaps, spark, and gradient direction as clean flat vectors, and deliberately leave out glow and glass effects, which don't scale down to small sizes. Before approving, the team should compare them side by side with the reference.
- **Wordmark isn't an exact Poppins trace.** No font-outlining tool was used. If the team wants exact Poppins SemiBold outlines, open `source/logo-full-text.svg` with Poppins installed, convert the text to outlines, and replace the wordmark group in both full logos. Keep the same position and size.
- **No PNG/ICO exports yet**, e.g. `apple-icon.png` (180 px), `favicon.ico`, or social preview images. Export them from the SVGs at scaffold time.
- **The reference image is not yet committed.** It stays at the repo root with its original filename (including the double `.png.png` extension) and must be committed with Phase 0 so it can't be lost.
- **Palette verification:** the four core hex values match the labels in the reference. The supporting shades and gradient stops were sampled by eye from the reference, and the team should confirm them.
