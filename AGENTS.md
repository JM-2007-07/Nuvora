# AGENTS.md: Faroz development conventions

This file is the **authoritative source for how work is done** in this repository: commands, conventions, safety rules, and approval gates. It applies to every contributor, human or AI. Product, architecture, design, and quality rules live in [`docs/`](docs/README.md); the workflow (task sizing, planning, delegation, review, stories) is in [docs/engineering/HARNESS.md](docs/engineering/HARNESS.md). Link to them; don't copy them here.

## What Faroz is

**Faroz** (formerly Nuvora, renamed in [D-23](docs/01-architecture/decisions.md); "Nuvora" never appears in the UI, internal names like `@nuvora/*` and `nuvora_dev` stay) is a multilingual EdTech platform. Learners take a diagnostic, see their gaps per topic, and get quests (lesson, practice, retest) with a before/after view. Teachers see their groups answer by answer. Centers see group totals and participation only ([vision](docs/00-product/vision.md), [design handoff](docs/02-design/FAROZ_HANDOFF.md)). Interface and content in **Russian (`ru`, default)**, Tajik (`tg`), and English (`en`).

The MVP is presented live at the **defense on Mon 2 Nov 2026** (implementation deadline Sun 1 Nov) from the team's laptop ([MVP scope](docs/00-product/mvp-scope.md)). Demo subject: JavaScript (5 topics and a 20-question diagnostic); the earlier Python Informatics subject is kept. Demo profiles without passwords, guest mode, and simple local accounts (no rate limiting, no `secure` cookie), so it **must not be deployed publicly**.

## Current phase

**Gate G4 (user-facing MVP), continued as the Faroz defense phases F1–F7** (as of 2026-10-29). G0, G1, and G3 are approved. G2's schema and migrations are applied with the owner's approval; its **Tajik copy review is still open**. Since 2026-10-28 G4 follows the [Faroz defense phases](docs/05-planning/roadmap.md#faroz-defense-phases-from-2026-10-28): public site, learner app, teacher and center workspaces, and accounts are implemented and verified on branch `feat/faroz-rebrand` (PR [JM-2007-07/Nuvora#1](https://github.com/JM-2007-07/Nuvora/pull/1)). Open items and the latest state: [handover story](docs/stories/2026-10-29-handover.md). The G4-A … G4-E table in the roadmap describes the earlier Nuvora plan. **Feature freeze** is a separate milestone, not a gate (see [Approval gates](#approval-gates)).

## Repository layout

| Path | Contents |
| --- | --- |
| `docs/` | Product, architecture, design, API, data, planning, quality, engineering docs, and [stories](docs/stories/README.md). Map: [docs/README.md](docs/README.md) |
| `assets/brand/` | Logo SVGs and `tokens.css`: the source of truth for brand assets |
| `apps/web/` | Next.js 16 frontend: `[locale]` routes, `features/<feature>/`, `messages/{tg,ru,en}.json` |
| `apps/api/` | NestJS 12 backend: feature modules (`catalog`, `lessons`, `quizzes`, `progress`, `recommendations`, `identity`), Prisma schema and migrations, seed content and loader |
| `packages/shared/` | Zod schemas and types shared by web and api (content, Content API, learning API) |
| `.claude/` | Project skills, subagents, settings, and launch configuration for Claude Code ([HARNESS.md](docs/engineering/HARNESS.md#delegation-and-the-agent-team)) |

## Commands

Run from the root as `pnpm <script>` (pnpm, [D-17](docs/01-architecture/decisions.md)). `lint`, `typecheck`, `test`, `build`, `dev`, and the seed scripts first run `prep` (builds `packages/shared`, generates the Prisma client). [VERIFICATION.md](docs/engineering/VERIFICATION.md) says which ones a change needs.

| Script | Purpose | Touches the database |
| --- | --- | --- |
| `dev` | Run web (:3000) and api (:4000) | Reads/writes through the app |
| `lint` / `typecheck` / `test` / `build` | Verification ([per-app tooling](#per-app-tooling)) | No |
| `format` / `format:check` | Prettier (Markdown excluded) | No |
| `seed:check` | Validate seed content | No |
| `db:validate` / `db:generate` | Validate the Prisma schema / generate the client | No |
| `db:status` | Migration status | Reads |
| `db:seed:dry-run` | Preview what `db:seed` would change ([seed loader](docs/04-data/data-model.md#seed-loader)) | Reads |
| `db:migrate` | Apply migrations | **Writes: owner approval** |
| `db:seed` | Load seed content (creates/updates only, never deletes) | **Writes: owner approval** |
| `db:seed:center` | Prepare the demo center for the group wizard: creates its organization row and the 4 unassigned students if missing; changes or deletes nothing | **Writes: owner approval** |
| `db:seed:demo` | Reset demo learners and B-12, remove guests, recreate demo teacher Dilshod's draft assessment, clear the demo center's invitations and permissions | **Writes: owner approval** |
| `pnpm --filter @nuvora/web test:e2e` | Playwright smoke test on the installed Edge | Through the app |
| `pnpm --filter @nuvora/api test:int` | Integration tests on the real PostgreSQL **test** database (`DATABASE_URL_TEST`, refuses a name without "test"); applies migrations and seed content there | Writes `nuvora_test` only |
| `admin:bootstrap -- --email <account>` | Grant Super Admin to an existing account (`--replace`, `--revoke`); the only way to grant it (D-27) | **Writes: owner only** |

`db:migrate` and `db:status` read `apps/api/.env`. The local database is the native PostgreSQL ([D-18](docs/01-architecture/decisions.md)). Creating roles or databases, or changing PostgreSQL or firewall configuration, needs the owner's explicit approval each time.

### Pinned toolchain (G1, 2026-10-25)

| Tool | Version | Note |
| --- | --- | --- |
| pnpm | 12.15.0 | `packageManager` field |
| TypeScript | 6.0.3 | Forced by `overrides` in `pnpm-workspace.yaml`. TypeScript 7 isn't supported by typescript-eslint yet |
| Next.js / React | 16.4.3 / 19.3.0 | `cacheComponents` and `partialPrefetching` deliberately off |
| NestJS | 12.2.0 (CLI 12.0.10) | ESM |
| Prisma | 7.10.1 (client, adapter-pg) | Not the 8.0 release candidate that npm currently tags as latest |
| next-intl / next-themes / Zod | 4.14.9 / 0.4.6 / 4.6.7 | |
| TanStack Query / react-markdown | 5.104.5 / 10.1.0 | D-01, D-12 |
| Motion for React (`motion`) | 14.6.0 (web) | D-22. Installed 2026-10-26; use `motion/react`, `LazyMotion` + `motion/react-m` |
| shadcn/ui | 4.22.1, preset `radix-vega` | Colours mapped to Faroz tokens in `apps/web/src/app/globals.css` |
| Playwright | `@playwright/test` 1.64.1 (web, dev only) | `channel: 'msedge'`: runs on the installed Microsoft Edge, no browser download |
| Profiles (D-25) | no new package: the photo crop is canvas in the browser | Public profile pages at `/u/<handle>`; editor at `/app/profile`, `/teach/profile`, `/center/profile` |
| Expo (mobile, D-29) | `expo` 58.0.21, `react-native` 0.88.1, `expo-router` 58.0.28, `expo-secure-store` 58.0.2, `expo-local-authentication` 58.0.2, `react-native-reanimated` 4.7.1 (exact versions in `apps/mobile/package.json`) | `apps/mobile`. Also `expo-file-system`, `expo-crypto`, `expo-linear-gradient`, `react-native-svg`, `lucide-react-native`, Google fonts and `react-native-web` for the dev preview (versions in the [mobile story](docs/stories/2026-10-31-mobile-app.md)). `pnpm --filter @nuvora/mobile typecheck` / `test` / `bundle:android` (Metro export, no Android SDK needed); browser preview: `mobile-web` in `.claude/launch.json` (:8081) |
| Socket.IO | `socket.io` / `socket.io-client` 4.8.4, `@nestjs/websockets` + `@nestjs/platform-socket.io` 12.2.0 (matches NestJS 12.2.0; 12.3.x needs a newer core) | D-24: chat and call signalling. Calls are WebRTC in the browser, no media server |

Homepage visual direction and Motion for React are approved in D-22 ([decisions](docs/01-architecture/decisions.md)); 3D libraries stay conditional, GSAP is not used.

**Migrations are forward-only and immutable once applied.** Never edit an applied `migration.sql`, because Prisma checksums it byte for byte. Change the schema with a new migration, which the owner reviews before it is applied. After applying, pin its SHA-256 in `apps/api/src/prisma/migrations-integrity.spec.ts`. `.gitattributes` keeps migration files LF on every OS.

**Dependency install scripts:** pnpm denies them by default. `allowBuilds` in `pnpm-workspace.yaml` is the only allow list. Never add a `true` entry, run `pnpm approve-builds`, or set `dangerouslyAllowAllBuilds` without the owner's approval.

**Brand copies:** `apps/web/src/styles/faroz-tokens.css` and `apps/web/public/brand/faroz-*.svg` are copies of `assets/brand/faroz/` (the Faroz source of truth, D-23). The older `brand-tokens.css` and `logo-*.svg` copies come from the Nuvora files in `assets/brand/` (D-16). Edit the source first, then copy.

## Per-app tooling

Linting and testing are set **per workspace** ([D-11](docs/01-architecture/decisions.md)). The root `lint` and `test` scripts run each workspace's own script.

| Workspace | Lint | Tests | Module format |
| --- | --- | --- | --- |
| `apps/api` (NestJS 12) | **oxlint** with type-aware checks (`.oxlintrc.json`) | **Vitest**: unit `*.spec.ts`, e2e `test/*.e2e-spec.ts` with in-memory Prisma fakes | ESM (`"type": "module"`). Relative imports end in `.js` |
| `apps/web` (Next.js 16) | **ESLint** with `eslint-config-next` | `node --test` (i18n key parity). **Playwright** smoke (`test:e2e`, separate from `pnpm test`). Manual demo script for UI | ESM (bundled by Next.js) |
| `packages/shared` | TypeScript type-check only | None yet | ESM |

One root Prettier config. Don't add Jest, or a second linter to a workspace, without a decision entry. `apps/web/AGENTS.md` is generated by `next dev` and only points to the Next.js 16 docs in `node_modules/next/dist/docs/`; read those before writing Next.js code. **This root file stays authoritative** for every other rule.

## Coding conventions

- **Clear over clever.** Plain functions and direct code. Add an abstraction only when a second real use exists. Pure logic (scoring, mastery, recommendations) has no Nest or Prisma imports and is unit-tested.
- TypeScript `strict` everywhere. No `any` without a comment explaining why.
- **API and shared schemas:** request/response shapes are defined once as Zod schemas in `packages/shared` and imported by both apps; no hand-written duplicates. Validate every external input (HTTP bodies, params, query, env vars, seed files) with Zod at the boundary and reject unknown fields. Error shape and endpoint contracts: [api-conventions.md](docs/03-api/api-conventions.md).
- **Quiz integrity:** correctness and explanations are never sent before submission; scoring is server-side only. `/me/*` data comes from the session cookie, never from client input.
- **Localization:** never hard-code user-facing strings. UI text goes through `messages/{tg,ru,en}.json` (key parity is tested); content uses `{ tg, ru, en }` maps with the documented fallback. Tajik formatting follows D-19. AI-drafted text stays `needs-review` until a native speaker checks it.
- **Design:** never hard-code colours; use the theme tokens ([design-system.md](docs/02-design/design-system.md)). Homepage and brand surfaces follow [VISUAL_EXPERIENCE.md](docs/engineering/VISUAL_EXPERIENCE.md). Don't redraw brand assets.
- **Accessibility, responsiveness, motion, performance:** WCAG 2.2 AA, from 360 px, keyboard-operable, `prefers-reduced-motion` honoured, Lighthouse targets ([quality-standards.md](docs/06-quality/quality-standards.md)).
- File names: `kebab-case`. React components: `PascalCase`. Database models: `PascalCase` singular. Small, feature-oriented modules ([architecture](docs/01-architecture/architecture.md#module-structure)).
- Add a dependency only for a stated need ([dependency rules](docs/engineering/HARNESS.md#dependencies)).

## Workflow and verification

Follow [HARNESS.md](docs/engineering/HARNESS.md): intake → context → plan → implement → verify → review → story → handoff, scaled to the task's size. Work in vertical slices. Update the authoritative docs in the same change when behaviour or a decision changes.

Before a change is called done, the checks [VERIFICATION.md](docs/engineering/VERIFICATION.md) selects for it pass locally (`lint`, `typecheck`, `test`, `build` for any code change). UI changes also get a browser check in light and dark and in at least one non-English locale. Report failures honestly; never mark a task done with a failing check, a skipped test, or an unverified claim.

## Git workflow

- `main` is always demoable. No direct commits to `main` once implementation starts. Use pull requests.
- Branch names: `feat/<short-topic>`, `fix/<short-topic>`, `docs/<short-topic>`, `chore/<short-topic>`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(quiz): score attempts per topic`.
- Keep PRs small (ideally under ~400 changed lines, excluding seed content and lockfiles). Every PR uses the [PR template](.github/pull_request_template.md) and gets one teammate review. Squash-merge.
- AI agents never commit, push, merge, change branches, or open PRs unless a human asks for it in that session.

## Security and secrets

- Secrets live only in git-ignored `.env` files. `.env.example` holds placeholders.
- Never paste real secrets into code, docs, stories, issues, commits, agent prompts, or chat.
- AI agents must not read, create, or modify `.env*` files (other than `.env.example`) without explicit permission. Project settings deny the file tools access to them; don't read them through the shell either.
- Full requirements: [quality-standards.md](docs/06-quality/quality-standards.md#security).

## Documentation rules

- The topic → document map in [docs/README.md](docs/README.md) is authoritative. Don't create a second document for a topic that already has one, or empty placeholders.
- Significant changes get a dated story in [docs/stories/](docs/stories/README.md) (threshold and template there). Never backfill invented history.
- Never mark a decision **Approved** unless the team approved it. Record who and when in [decisions.md](docs/01-architecture/decisions.md). **Proposed** means not approved.

## Approval gates

Work stops at each gate until the team explicitly approves.

| Gate | What gets approved | Before |
| --- | --- | --- |
| **G0** ✅ | Project foundation: Phase 0 docs, brand assets, all decisions. Approved 2026-10-25 | Any scaffolding |
| **G1** ✅ | Application shell: walking skeleton per the [G1 checklist](docs/05-planning/roadmap.md#gate-g1-checklist-mon-oct-26). Approved 2026-10-25 | Feature work |
| **G2** | Data schema and content preparation ([G2 checklist](docs/05-planning/roadmap.md#gate-g2-checklist)). Migrations applied with the owner's approval on 2026-10-25. **Tajik copy review still open** | Content writing at scale |
| **G3** ✅ | Seed loader (`db:seed`, `db:seed:dry-run`) and read-only Content API, verified against real PostgreSQL data in `nuvora_dev`. Approved 2026-10-25 | User-facing MVP work |
| **G4** | User-facing MVP: G4-A content, G4-B distinctive homepage, G4-C subject and lesson pages, G4-D complete learning loop, G4-E verification and demo readiness ([roadmap](docs/05-planning/roadmap.md#g4-user-facing-mvp)) | Feature freeze |

**Feature freeze** is a separate milestone: the implementation deadline, Sun 1 Nov 2026, before the defense on Mon 2 Nov. After it, only bug fixes and content change. (The original plan had the freeze on Fri Oct 30 and the presentation on Sat Oct 31; the owner moved to the defense date with D-23.) The release check includes the Tajik copy review ([quality gates](docs/06-quality/quality-standards.md#quality-gates)).

Also requires approval at any time: changing an **Approved** decision, adding a library with architectural impact (including the conditional 3D libraries in D-22), installing or upgrading packages, changing the database schema, writing to or resetting database data, or removing an MVP requirement. The full list is in [HARNESS.md](docs/engineering/HARNESS.md#actions-that-need-approval).
