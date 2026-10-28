# ADR-0001: Core technology stack

- Status: **Approved** (decision D-01, G0, owner, 2026-10-25)
- Date: 2026-10-25

## Context

A small student team needs to deliver a multilingual, themed web app with a complete learning loop in about five working days. Then it must keep growing. The team proposed a stack. This ADR records it and the trade-offs.

## Decision

| Layer | Choice | Role |
| --- | --- | --- |
| Language | TypeScript (strict) | One language across frontend, backend, and shared schemas |
| Frontend | Next.js (App Router) | Routing, server rendering of content pages, locale-prefixed routes |
| UI | Tailwind CSS + shadcn/ui | Accessible primitives (Radix-based) that we own and theme with brand tokens |
| Server state | TanStack Query | Caching and invalidation for learner data (attempts, progress) |
| Motion | Motion for React | Small, purposeful transitions. Respects reduced motion |
| Backend | NestJS | Modular structure, dependency injection, guards for authorization |
| Database | PostgreSQL + Prisma | Relational model fits subjects → topics → lessons/quizzes. Prisma gives typed queries and migrations |
| Validation | Zod | Shared schemas for API contracts, env config, and seed files |

Supporting libraries already implied by the stack (also approved): next-intl (D-05), next-themes (D-15), react-markdown (D-12).

## Consequences

**Positive**
- End-to-end TypeScript. Shared Zod schemas catch contract drift at compile time.
- Plenty of documentation and examples, which matters for a student team on a deadline.
- shadcn/ui components are copied into the repo, so they can be adapted to the brand.

**Negative / risks**
- **Two servers** (Next.js + NestJS) mean more setup, CORS, and two processes to run in the demo. A Next.js-only app (Route Handlers + Prisma) would be faster to build. We keep NestJS because the team proposed it and it gives a clearer backend structure for growth. See the fallback rule below.
- NestJS's default validation is class-validator. We use Zod instead to share schemas, which needs a small custom validation pipe.
- Prisma's `Json` columns are untyped. They are validated with Zod on read and write ([ADR-0003](0003-localized-content-as-json.md)).

## Is NestJS + Next.js achievable by Monday?

**Yes, if the two tooling decisions (D-17 package manager, D-18 database) are settled before Monday morning.** Node 24 and PostgreSQL 18 are already installed and running. Both apps come from official generators (`create-next-app`, Nest CLI), and the remaining G1 work is mostly configuration ([G1 checklist](../../05-planning/roadmap.md#gate-g1-checklist-mon-oct-26)). For one focused developer, that is about one working day. The main time risks are workspace/TypeScript configuration between three packages, and CORS plus cookies across two local ports.

**Fallback rule:** if by **Monday 20:00** the walking skeleton doesn't work, meaning the web page can't show data that the API read from PostgreSQL through Prisma, the owner decides between one more morning and switching to **Next.js only**:

- The API modules become Route Handlers under `apps/web/src/app/api/v1/`, with the same paths and error format.
- The Prisma schema, the shared Zod package, and the pure scoring, mastery, and recommendation functions move over unchanged. That's why they are written without Nest imports.
- The cookie session and CORS concerns get simpler (one origin).

The documents describe the two-app design. If the fallback is used, update [architecture.md](../architecture.md) and this ADR in the same change.

## Alternatives considered

- **Next.js only (no NestJS):** fewer moving parts and faster for the MVP, but less separation for future mobile clients and growth. Not chosen, because the team proposal includes NestJS. Kept as the documented fallback (above).
- **Drizzle instead of Prisma:** lighter, SQL-like. Prisma has the better beginner experience and migration tooling.
