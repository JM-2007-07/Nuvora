# AGENTS.md: Nuvora development conventions

This file is the **authoritative source for how work is done** in this repository: workflow, git, commands, coding conventions, and approval gates. It applies to every contributor, human or AI. Product, architecture, and quality rules live in [`docs/`](docs/README.md). Link to them; don't copy them here.

## Current phase

**Phase 2: Gate G2 (Prisma schema + seed content format), planning.** G0 and G1 were approved on 2026-10-25. G2 work starts only after the owner approves the G2 plan. No product features until G2 is approved (see [Approval gates](#approval-gates)).

## Repository layout

| Path | Contents | Status |
| --- | --- | --- |
| `docs/` | Product, architecture, design, API, data, planning, quality docs | exists |
| `assets/brand/` | Logo SVGs, `tokens.css` | exists |
| `apps/web/` | Next.js frontend | planned |
| `apps/api/` | NestJS backend + Prisma schema | planned |
| `packages/shared/` | Zod schemas and types shared by web and api | planned |

## Commands

None exist yet. When the workspace is scaffolded, these root scripts must exist and are the only verification interface:

| Script | Purpose |
| --- | --- |
| `dev` | Run web and api locally |
| `lint` | Each workspace's own linter ([per-app tooling](#per-app-tooling)) |
| `typecheck` | `tsc --noEmit` in every package |
| `test` | Each workspace's own tests ([per-app tooling](#per-app-tooling)) |
| `build` | Production build of every app |
| `db:migrate` / `db:seed` | Apply Prisma migrations / load seed content and reset demo learners |

Run them as `pnpm <script>` (pnpm, [D-17](docs/01-architecture/decisions.md)). The root `lint`, `typecheck`, `test`, `build`, and `dev` scripts first run `prep`, which builds `packages/shared` and generates the Prisma client. `db:validate` and `db:generate` need no database. `db:migrate` and `db:status` read `apps/api/.env` and touch the database. The local database is the native PostgreSQL ([D-18](docs/01-architecture/decisions.md)). Creating roles or databases, or changing PostgreSQL or firewall configuration, needs the owner's explicit approval each time.

### Pinned toolchain (G1, 2026-10-25)

| Tool | Version | Note |
| --- | --- | --- |
| pnpm | 12.15.0 | `packageManager` field |
| TypeScript | 6.0.3 | Forced by `overrides` in `pnpm-workspace.yaml`. TypeScript 7 isn't supported by typescript-eslint yet |
| Next.js / React | 16.4.3 / 19.3.0 | `cacheComponents` and `partialPrefetching` deliberately off |
| NestJS | 12.2.0 (CLI 12.0.10) | ESM |
| Prisma | 7.10.1 (client, adapter-pg) | Not the 8.0 release candidate that npm currently tags as latest |
| next-intl / next-themes / Zod | 4.14.9 / 0.4.6 / 4.6.7 | |
| shadcn/ui | 4.22.1, preset `radix-vega` | Colours mapped to Nuvora tokens in `apps/web/src/app/globals.css` |

**Dependency install scripts:** pnpm denies them by default. `allowBuilds` in `pnpm-workspace.yaml` is the only allow list. Never add a `true` entry, run `pnpm approve-builds`, or set `dangerouslyAllowAllBuilds` without the owner's approval.

**Brand copies:** `apps/web/src/styles/brand-tokens.css`, `apps/web/public/brand/*.svg`, and `apps/web/src/app/icon.svg` are copies of `assets/brand/` (D-16). Edit the source first, then copy.

## Per-app tooling

Linting and testing are set **per workspace**. No single linter or test runner covers the whole repository ([D-11](docs/01-architecture/decisions.md)). The root `lint` and `test` scripts just run each workspace's own script.

| Workspace | Lint | Tests | Module format |
| --- | --- | --- | --- |
| `apps/api` (NestJS 12) | **oxlint** with type-aware checks (`.oxlintrc.json`) | **Vitest** (`*.spec.ts`) | ESM (`"type": "module"`). Relative imports end in `.js` |
| `apps/web` (Next.js 16) | **ESLint** with `eslint-config-next` (`eslint.config.mjs`) | Node's built-in runner (`node --test`) for the i18n key-parity test. Manual demo script for UI | ESM (bundled by Next.js) |
| `packages/shared` | TypeScript type-check only | None yet | ESM |

Formatting uses one root Prettier config for every workspace. Don't add Jest, or a second linter to a workspace, without a decision entry.

`apps/web/AGENTS.md` is generated and re-created by `next dev`. It only points agents to the Next.js docs bundled in `node_modules/next/dist/docs/`. **This root file stays authoritative** for every other rule.

## Coding conventions

- TypeScript `strict` everywhere. No `any` without a comment explaining why.
- Validate every external input (HTTP bodies, query params, env vars, seed files) with Zod at the boundary.
- Request/response shapes are defined once in `packages/shared` and imported by both apps. Don't hand-write duplicates.
- Never hard-code user-facing strings. UI text goes through the i18n message files for `tg`, `ru`, `en`.
- Never hard-code colours. Use the theme tokens from [design-system.md](docs/02-design/design-system.md).
- File names: `kebab-case`. React components: `PascalCase`. Database models: `PascalCase` singular.
- Keep modules small and feature-oriented (see [architecture](docs/01-architecture/architecture.md#module-structure)).
- Add a dependency only when it solves a stated need. Record it in the PR description, and in [decisions.md](docs/01-architecture/decisions.md) if it is architectural.

## Task decomposition

1. Restate the task and find the authoritative docs it touches.
2. For anything bigger than a single small change, write a short plan: files to touch, risks, how it will be verified.
3. Work in vertical slices (data → API → UI for one feature) rather than building all layers horizontally.
4. Verify (see below) before declaring a task done.
5. Update the authoritative docs in the same change if behaviour or a decision changed.

## Verification

Before a change is called done, the `lint`, `typecheck`, `test`, and `build` scripts all pass locally. UI changes also get a manual check in light and dark themes and in at least one non-English locale. The full gate list is in [quality-standards.md](docs/06-quality/quality-standards.md#quality-gates).

Report failures honestly. Never mark a task done with a failing check, a skipped test, or an unverified claim.

## Git workflow

- `main` is always demoable. No direct commits to `main` once implementation starts. Use pull requests.
- Branch names: `feat/<short-topic>`, `fix/<short-topic>`, `docs/<short-topic>`, `chore/<short-topic>`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(quiz): score attempts per topic`.
- Keep PRs small (ideally under ~400 changed lines, excluding seed content and lockfiles).
- Every PR uses the [PR template](.github/pull_request_template.md) and gets one teammate review before merge. Squash-merge.
- AI agents never commit, push, merge, or open PRs unless a human asks for it in that session.

## Security and secrets

- Secrets live only in `.env` files that are git-ignored. Commit a `.env.example` with placeholder values.
- Never paste real secrets into code, docs, issues, commits, or chat with an AI agent.
- AI agents must not read, create, or modify `.env*` files (other than `.env.example`) without explicit permission.
- Full security requirements: [quality-standards.md](docs/06-quality/quality-standards.md#security).

## Documentation rules

- The topic → document map in [docs/README.md](docs/README.md) is authoritative. Don't create a second document for a topic that already has one.
- Don't create empty placeholder documents.
- Never mark a decision **Approved** unless the team approved it. Record who and when in [decisions.md](docs/01-architecture/decisions.md).

## Approval gates

Work stops at each gate until the team explicitly approves.

| Gate | What gets approved | Before |
| --- | --- | --- |
| **G0** ✅ | Phase 0 docs, brand assets, all decisions. Approved 2026-10-25 | Any scaffolding |
| **G1** ✅ | Walking skeleton per the [G1 checklist](docs/05-planning/roadmap.md#gate-g1-checklist-mon-oct-26). Approved 2026-10-25 | Feature work |
| **G2** | Prisma schema + seed content format | Running the first migration that other work depends on |
| **G3** | Feature freeze (Fri Oct 30, 12:00) | Anything except bug fixes and content |

Also requires approval at any time: changing an **Approved** decision, adding a new framework/library with architectural impact, changing the database schema after G2, or removing an MVP requirement.
