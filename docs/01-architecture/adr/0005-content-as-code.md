# ADR-0005: Content as code for the MVP

- Status: **Approved** (decision D-14, G0, owner, 2026-10-25)
- Date: 2026-10-25

## Context

The MVP needs real, translated learning content, but an admin interface (forms, validation, permissions, preview) would take days we don't have.

## Decision

- MVP content (subjects, topics, prerequisites, lessons, resources, quizzes, questions) is written as **structured seed files** in the repo (e.g. `apps/api/prisma/seed/content/<subject>/*.json` or `.ts`; exact format approved at G2).
- A seed script validates every file with the shared Zod schemas, then upserts the content by stable slugs. Running it again is safe.
- The seed check also enforces the [integrity rules](../../04-data/data-model.md#integrity-rules-enforced-by-the-seed-check-and-db-constraints-where-possible): all three locales for core demo content, at least 3 questions per topic in each quiz, valid prerequisite references, and no prerequisite cycles.
- The same seed creates the demo learners and their history through the real scoring code ([ADR-0006](0006-demo-profiles-and-guest-mode.md)).
- Content changes go through PRs like code, so there is review and history for free.

## Consequences

- No admin UI on the critical path. Content writers can start immediately, in parallel with development, from a template.
- Writers need basic Git/JSON comfort. Provide one fully worked example topic as a template.
- An admin/teacher authoring UI is deferred (FR-AUTH-04). It can reuse the same Zod schemas later.
