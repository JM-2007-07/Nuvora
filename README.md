<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/faroz/faroz-logo-dark.svg">
    <img src="assets/brand/faroz/faroz-logo.svg" alt="Faroz" width="300">
  </picture>
</p>

<p align="center"><strong>Find your gaps. Level them up.</strong></p>

# Faroz

Faroz is a multilingual EdTech platform (Russian by default, Tajik, English). The name comes from Tajik «фароз»: height, rising upward.

A learner takes a short diagnostic, sees exactly which topics are weak, and gets **quests** for each gap: a lesson, practice with instant feedback, and a retest that proves progress. Teachers see their groups answer by answer. Educational centers see group totals and participation only.

**Learning loop:** diagnostic → results by topic → quest for the weakest topic (lesson, practice) → retest → before/after progress.

## Project status

- **Defense: Monday, 2 November 2026** (implementation deadline Sun 1 Nov). Runs locally on the team's laptop from a production build. It is a demo, not a public deployment.
- **Done and verified** (details in the [stories](docs/stories/README.md), latest: [handover](docs/stories/2026-10-29-handover.md)):
  - JavaScript subject: 5 topics with lessons, real resources, 5-question quizzes, and a 20-question diagnostic. The older Python "Informatics" subject is kept.
  - Learner app, teacher workspace, center workspace, public site, accounts and demo plans.
  - Everything runs through the real NestJS API and PostgreSQL. Scoring, roles, and privacy are enforced on the server.
- **Open:** native-speaker review of the Russian and Tajik texts (AI drafts so far), demo rehearsal and backup video, Lighthouse and a full keyboard pass.
- Branch `feat/faroz-rebrand`, PR [JM-2007-07/Nuvora#1](https://github.com/JM-2007-07/Nuvora/pull/1) into `main`.

The rebrand is decision **D-23** ([decisions](docs/01-architecture/decisions.md)). The design source of truth is [FAROZ_HANDOFF.md](docs/02-design/FAROZ_HANDOFF.md). "Nuvora" is the former name: it never appears in the UI, but internal package names (`@nuvora/*`), the repository name, and the local database names stay as they are for now.

## What's in the app

| Area | Routes | Who |
| --- | --- | --- |
| Public site | `/`, `/start`, `/login`, `/signup`, `/library`, `/privacy`, `/terms` | Everyone |
| Learner app | `/app` (dashboard), `/app/quests`, `/app/quest/[quiz]`, `/app/results`, `/app/skills`, `/app/progress`, lessons and topics | Learners, demo learners, guests |
| Teacher workspace | `/teach`, classes, students (answer by answer), assessments and the 5-step builder, gap insights, analytics, settings | Teachers |
| Center workspace | `/center`, groups, staff with teacher invitations, students (participation only), analytics, settings with editable coordinator permissions | Center admins, coordinators |
| Invitation page | `/invite/[token]`: an invited teacher accepts with a teacher account | Invited teachers |

Every route is prefixed with the locale: `/ru` (default), `/tg`, `/en`. Dark "Game Mode" is the default theme, with a sun/moon toggle that remembers the choice.

**Demo identities** (no password): learners Amina Rahimova, Farzona, Rustam, or a guest. Staff: Dilshod Karimov (teacher), Komila Rasulova (coordinator), Farhod Jalilov (center admin). Demo group **B-12** (26 learners) is replayed from the design's answers, so every teacher and center figure is computed from stored data. Demo numbers come only from the design data and are never invented.

**Privacy rule:** learners see only their own results. Teachers see their own groups answer by answer. Centers see group totals and participation, never individual scores or answers, and never who got targeted practice.

## Stack

| Part | Technology |
| --- | --- |
| Web (`apps/web`) | Next.js 16, React 19, next-intl, TanStack Query, Tailwind CSS 4 with Faroz tokens, shadcn/ui, Motion for React |
| API (`apps/api`) | NestJS 12, Prisma 7, PostgreSQL (native, no Docker) |
| Shared (`packages/shared`) | Zod schemas and types used by both apps |
| Tooling | pnpm 12 workspaces, TypeScript 6, oxlint + Vitest (api), ESLint + Playwright on Microsoft Edge (web) |

Fonts: Unbounded (headings, buttons, wordmark) and Inter (text, and Tajik headings, because Unbounded lacks ҳ ҷ ӣ ғ қ ӯ). Exact versions are pinned in [AGENTS.md](AGENTS.md#pinned-toolchain-g1-2026-10-25).

## Repository layout

```text
.
├── AGENTS.md            Development conventions (authoritative for workflow)
├── CLAUDE.md            Instructions for Claude Code (Faroz design rules)
├── apps/
│   ├── web/             Next.js app: public site, /app, /teach, /center; messages/{ru,tg,en}
│   └── api/             NestJS API + Prisma schema, migrations, seed content and loader
├── packages/shared/     Zod contracts shared by web and api
├── assets/brand/faroz/  Faroz logos, icons, tokens.css (source of truth)
├── docs/                Product, architecture, design, API, data, planning, quality,
│                        engineering docs, and dated stories
├── .claude/             Claude Code skills, subagents, settings, launch config
└── .github/             Pull request template
```

`faroz-handoff/` (design screenshots, artboards, demo JSON) is local only and stays untracked.

## Getting started

### Prerequisites

- Node.js 24 or newer
- pnpm 12.15.0 (`npm install -g pnpm@12.15.0`), pinned in `package.json`
- PostgreSQL 16 or newer, installed natively
- Microsoft Edge (only for the Playwright tests)

### 1. Install dependencies

```bash
pnpm install
```

Dependency install scripts are blocked by default. Only those set to `true` under `allowBuilds` in `pnpm-workspace.yaml` run (currently only `@prisma/engines`). Adding one needs the owner's approval.

### 2. Create the local database (once per machine)

Run as the PostgreSQL superuser, choosing your own password:

```bash
psql -U postgres -h localhost
```

```sql
CREATE ROLE nuvora LOGIN PASSWORD 'choose-a-password';
CREATE DATABASE nuvora_dev OWNER nuvora;
CREATE DATABASE nuvora_test OWNER nuvora;
CREATE DATABASE nuvora_shadow OWNER nuvora;
```

Copy `apps/api/.env.example` to `apps/api/.env` and replace the `CHANGE_ME` values. Never commit `.env`.

### 3. Migrate, load content, and run

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

`db:seed` is safe to re-run: it creates and updates content, never deletes it. `pnpm db:seed:dry-run` previews the changes ([seed loader](docs/04-data/data-model.md#seed-loader)).

```bash
pnpm db:seed:demo
```

`db:seed:demo` resets the demo learners and group B-12, removes guests, recreates teacher Dilshod's draft assessment, and clears the demo center's invitations and permission changes. Run it before each demo. It does not remove registered accounts.

```bash
pnpm dev
```

The web app opens on http://localhost:3000 (redirects to `/ru`), the API on http://localhost:4000/api/v1 (`/health` shows the database status). For the demo, use a production build: `pnpm build`, then `pnpm --filter @nuvora/web start`.

### Checks

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm seed:check` need no database. The browser tests run separately on the installed Edge: `pnpm --filter @nuvora/web test:e2e`. Which checks a change needs is in [VERIFICATION.md](docs/engineering/VERIFICATION.md).

## Known limits

Demo profiles have no passwords, there is no rate limiting, and the session cookie has no `secure` flag (local http). **Do not deploy publicly.**

## Documentation

- Index: [docs/README.md](docs/README.md)
- Design: [FAROZ_HANDOFF.md](docs/02-design/FAROZ_HANDOFF.md); tokens and logos in [assets/brand/faroz](assets/brand/faroz)
- Change history: [docs/stories](docs/stories/README.md)
- Workflow and gates: [AGENTS.md](AGENTS.md), [HARNESS.md](docs/engineering/HARNESS.md)
