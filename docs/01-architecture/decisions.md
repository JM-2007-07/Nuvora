# Decision register

This is the authoritative list of decisions and their status. Read it before building on any technology or rule. ADRs explain the reasoning where a trade-off needs it.

**Rule:** only the team (project owner) changes a status to **Approved**. Record who approved it and when. AI agents may propose changes and record decisions the owner states, but never approve them on their own.

**Gate G0 was approved by the owner on 2026-10-25.** The Phase 0 documentation and brand package are the project baseline. **Gate G1 (walking skeleton) was approved on 2026-10-25.**

## Approved

### Product and brand

| ID | Decision | Decided |
| --- | --- | --- |
| A-01 | Product name **Nuvora**, tagline "Discover more. Become more.", ribbon-N logo direction. Reference: [`nuvora-logo-concept.png.png`](../../nuvora-logo-concept.png.png) at the repo root, kept unmodified | Owner, before Phase 0 |
| A-02 | Languages: Tajik, Russian, English | Owner, before Phase 0 |
| A-03 | Appearance: light, dark, and system | Owner, before Phase 0 |
| A-04 | Presentation on Sat, Oct 31, 2026 with an end-to-end learning loop | Owner, before Phase 0 |
| D-03 | **Accounts:** seeded demo profiles plus guest mode. No email/password registration in the MVP ([ADR-0006](adr/0006-demo-profiles-and-guest-mode.md)) | Owner, 2026-10-25 |
| D-06 | **Localization:** Russian (`ru`) is the default interface language, and Tajik and English are available through a language switcher (order: Русский, Тоҷикӣ, English). Core demo content must exist in all three languages. Fallback strategy: [architecture](architecture.md#localization). Changed from a Tajik default by the owner on 2026-10-26 | Owner, 2026-10-25; default changed 2026-10-26 |
| D-07 | **Interface font: Inter**, verified for the Tajik letters and Russian Cyrillic ([verification](architecture.md#fonts-d-07)). The brand wordmark stays independent of the interface font (vector SVG) | Owner, 2026-10-25 |
| D-08 | **Demo subject:** introductory Computer Science / Informatics, six connected topics ([topic graph](../00-product/mvp-scope.md#demo-subject-introductory-informatics)) | Owner, 2026-10-25 |
| D-10 | **Demo environment:** local presentation on the team's laptop, with a recorded backup video | Owner, 2026-10-25 |
| D-20 | **Python is used only as an optional language for educational code examples** in Informatics lessons and questions (identifiers in English, comments and explanations translated). It is **not** part of the application stack: no Python runtime, tooling, or code execution in the app | Owner, 2026-10-25 |

### Technology and architecture (approved with G0)

| ID | Decision | Details |
| --- | --- | --- |
| D-01 | Stack: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query + Motion · NestJS · PostgreSQL + Prisma · Zod. **Fallback:** Next.js-only, if the Monday walking-skeleton check fails | [ADR-0001](adr/0001-core-technology-stack.md) |
| D-02 | Monorepo: workspaces with `apps/web`, `apps/api`, `packages/shared`. No Turborepo/Nx | [ADR-0002](adr/0002-monorepo-with-shared-schemas.md) |
| D-04 | Localized content stored as JSON locale maps (`{ "tg": "...", "ru": "...", "en": "..." }`) | [ADR-0003](adr/0003-localized-content-as-json.md) |
| D-05 | UI i18n with **next-intl** and locale-prefixed URLs (`/tg`, `/ru`, `/en`). No automatic browser-language detection | [architecture](architecture.md#localization) |
| D-09 | Knowledge Map drawn with plain SVG, using positions stored in seed data. No graph library | [design-system](../02-design/design-system.md#knowledge-map) |
| D-11 | **Per-app tooling. No single linter or test runner covers the whole workspace.** `apps/api`: **Vitest** (tests) and **oxlint with type-aware checks** (lint), both NestJS 12 defaults, in ESM with `.js` import suffixes. `apps/web`: **ESLint** with `eslint-config-next` (lint), Node's built-in test runner (`node --test`) for the i18n key-parity test, a **Playwright** browser smoke test (`test:e2e`, on the installed Microsoft Edge, no browser download; approved at G2 on 2026-10-25), and a manual demo script. `packages/shared`: TypeScript type-check only. Revised from "Jest in `apps/api`" when NestJS 12 turned out to generate Vitest and oxlint (owner, 2026-10-25) | [quality-standards](../06-quality/quality-standards.md#test-strategy), [AGENTS.md](../../AGENTS.md#per-app-tooling) |
| D-12 | Lesson bodies and question prompts are Markdown, rendered with `react-markdown` (raw HTML disabled). No syntax highlighting in the MVP | [data-model](../04-data/data-model.md) |
| D-13 | Mastery thresholds and recommendation rules (rule-based, no ML) | [ADR-0004](adr/0004-rule-based-mastery-and-recommendations.md) |
| D-14 | MVP content is authored as versioned seed files reviewed through PRs. Demo learner history is seeded through the real scoring code | [ADR-0005](adr/0005-content-as-code.md) |
| D-15 | Theme switching with **next-themes** (class strategy) | [architecture](architecture.md#theming) |
| D-16 | Brand assets live in `assets/brand/` and are copied into `apps/web/public/brand/` at scaffold time | [BRAND_GUIDELINES](../02-design/BRAND_GUIDELINES.md#using-the-assets-in-nextjs) |
| D-17 | **Package manager: pnpm**, subject to verifying its installation and version before use. The exact version is pinned in the root `package.json` `packageManager` field. Checked 2026-10-25: not installed yet, so installing it is a G1 step that needs approval | Owner, 2026-10-25 |
| D-18 | **Database: the existing native PostgreSQL 18.6** (Windows service `postgresql-x64-18`, port 5432) for local development. Docker is not required. **Creating roles or databases, changing PostgreSQL configuration, or changing firewall settings needs the owner's explicit approval each time** | Owner, 2026-10-25 |
| D-21 | **Deletion policy:** content deletion never erases learner history. The five history → content foreign keys use `ON DELETE RESTRICT`; user deletion still cascades. A published question's meaning is never changed in place (new key instead). Forward-only migration `20261025180000_protect_learner_history` | Owner, 2026-10-25 ([data-model](../04-data/data-model.md#deletion-policy)) |
| D-19 | **Tajik formatting:** deterministic date (`dd.MM.yyyy` or our own month names) and percentage (`{value}%`) formatting. `Intl` locale data is never relied on for `tg`, which prevents SSR hydration mismatches. Tajik plural messages use only the `other` form | Owner, 2026-10-25 ([architecture](architecture.md#formatting-d-19)) |
| D-22 | **Homepage visual direction** ([VISUAL_EXPERIENCE.md](../engineering/VISUAL_EXPERIENCE.md)): a luminous knowledge core with connected subject/topic nodes drawn from real prerequisite data, restrained violet and teal light on deep navy, atmospheric depth, purposeful motion with a reduced-motion path, integrated imagery, and a distinctive responsive layout (mobile composed, not shrunk). Not a grid of course cards. **Approved:** the direction, and installing **Motion for React** (`motion`, pinned) for G4-B after compatibility checks. **Conditional, each needs its own justification and test before use:** Canvas 2D particles; Three.js / React Three Fiber / Drei (only if a prototype and measurement show SVG/CSS/Motion can't reach the intended depth, and only after a further owner OK). **Not now:** GSAP or any other animation framework | Owner, 2026-10-26 |

## Proposed

None.

## Open

None.

## Changing a decision

1. Propose the change in a PR that updates this table (and the ADR, if one exists).
2. Explain what changes downstream (code, docs, schedule).
3. Get the owner's approval before merging. Approved decisions don't change silently.
