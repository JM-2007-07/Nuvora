# ADR-0002: Monorepo with a shared schema package

- Status: **Approved** (decisions D-02, D-17, G0, owner, 2026-10-25)
- Date: 2026-10-25

## Context

The web app and the API must agree on request and response shapes, supported locales, and enums (question types, mastery statuses). Keeping duplicate definitions in sync by hand is a common source of bugs.

## Decision

One repository with **pnpm** workspaces (D-17):

```text
apps/web          Next.js
apps/api          NestJS + prisma/
packages/shared   Zod schemas + inferred types + constants (locales, enums)
```

- `packages/shared` depends only on Zod. Both apps import from it.
- No Turborepo/Nx. Root `package.json` scripts run each workspace (`pnpm -r`). Add a build orchestrator only if build times become a real problem.

## Consequences

- A change to a contract shows up as a type error in both apps immediately.
- One place for lint/format config and one PR for a full-stack feature.
- The shared package must stay free of Node-only or browser-only code.
- Prisma types stay inside `apps/api`. The API maps database rows to shared schema shapes, so the database layout doesn't leak into the contract.
