# Faroz logo files

Drop these into a Next.js project's `public/` folder.

| File | Use |
|---|---|
| `faroz-logo.svg` / `.png` | Horizontal logo for light backgrounds |
| `faroz-logo-dark.svg` / `.png` | Horizontal logo for dark backgrounds (default, dark Home) |
| `faroz-logo-mono-black.svg`, `faroz-logo-mono-white.svg` | One-colour logo |
| `faroz-logo-tg.svg`, `faroz-logo-tg-dark.svg` (+ `.png`) | Tajik Cyrillic lockup «Фароз» — Tajik-language pages only |
| `faroz-mark.svg` / `.png`, `faroz-mark-dark.svg` / `.png` | Standalone symbol for light / dark backgrounds |
| `faroz-mark-mono-black.svg`, `faroz-mark-mono-white.svg` | One-colour symbol |
| `faroz-app-icon.svg` / `.png` (1024), `faroz-app-icon-light.svg` / `.png` | App icon, dark and white tile |
| `icon-192.png`, `icon-512.png` | Web app manifest icons |
| `apple-touch-icon.png` | iOS home screen, 180 px, full-bleed square (iOS rounds the corners) |
| `favicon.svg`, `favicon.ico` (16/32/48), `favicon-16.png`, `favicon-32.png` | Browser tab icon (no spark — too small to read) |

Logos and symbols have transparent backgrounds; icons sit on their own tile.
The wordmark is drawn as vector strokes to match Unbounded Bold, so the files don't need the font installed.

Next.js App Router: you can also copy `favicon.ico` to `app/favicon.ico` and `apple-touch-icon.png` to `app/apple-icon.png`.
