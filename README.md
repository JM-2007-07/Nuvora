<p align="center">
  <img src="assets/brand/logo-full.svg" alt="Nuvora" width="320">
</p>

<p align="center"><em>Discover more. Become more.</em></p>

# Nuvora

Nuvora is a multilingual educational platform (Tajik, Russian, English). It helps learners study academic subjects through structured lessons, find recommended books and resources, test their knowledge with quizzes, see which topics are weak, and know what to study next.

**Core learning loop:** choose a subject → study a lesson → take a quiz → identify weak topics → review recommended material → track progress.

## Project status

**G0 and G1 approved (2026-10-25). Next: Gate G2, the Prisma schema and seed content format.** The apps contain infrastructure only, with no product features yet (see [Approval gates](AGENTS.md#approval-gates)).

- Presentation date: **Saturday, October 31, 2026**, run locally on the team's laptop with a recorded backup video. The target is a presentation-ready MVP with one complete learning loop on **introductory Informatics** (six topics), in Tajik (default), Russian, and English. Learners use demo profiles or guest mode. See [MVP scope](docs/00-product/mvp-scope.md).
- Approved stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Motion, NestJS, PostgreSQL, Prisma, Zod. Interface font: Inter. See [decisions](docs/01-architecture/decisions.md).

## Repository layout

```text
.
├── AGENTS.md            Development conventions (authoritative for workflow)
├── CLAUDE.md            Instructions for Claude Code
├── apps/
│   ├── web/             Next.js 16 app (i18n, theme, brand shell)
│   └── api/             NestJS 12 API + Prisma 7 (prisma/)
├── packages/shared/     Zod schemas, types, locales shared by web and api
├── assets/brand/        Logo SVGs and brand colour tokens (source of truth)
├── docs/                Product, architecture, design, API, data, planning, quality
└── .github/             Pull request template
```

See [architecture](docs/01-architecture/architecture.md).

## Getting started

### Prerequisites

- Node.js 24 or newer
- pnpm 12.15.0 (`npm install -g pnpm@12.15.0`). The exact version is pinned in `package.json`
- PostgreSQL 16 or newer, installed natively. Docker is not required

### 1. Install dependencies

```bash
pnpm install
```

Dependency install scripts are blocked by default. Only those listed as `true` under `allowBuilds` in `pnpm-workspace.yaml` run (currently only `@prisma/engines`). Adding one needs the owner's approval.

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

Then copy `apps/api/.env.example` to `apps/api/.env` and replace `CHANGE_ME` with that password. Never commit `.env`.

### 3. Apply migrations and run

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

The web app runs on http://localhost:3000 (it opens `/tg`) and the API on http://localhost:4000/api/v1 (`/health` shows the database status).

### Checks

`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` must pass before a change is done. They need no database. Tools differ per app: see [AGENTS.md](AGENTS.md#per-app-tooling).

Documentation index: [docs/README.md](docs/README.md).

## Brand

Logos and colour tokens are in [assets/brand](assets/brand). Usage rules are in the [brand guidelines](docs/02-design/BRAND_GUIDELINES.md).
