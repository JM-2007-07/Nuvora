---
name: add-lesson-content
description: Checklist for adding or changing Nuvora educational content (topics, lessons, quiz questions, and recommended resources in Tajik, Russian, and English) in the seed files under apps/api/src/seed/content/. Use when writing, translating, or editing lessons, quizzes, or resources.
---

# Add or change lesson content

Content lives in TypeScript seed files, one file per topic (ADR-0005). The authoritative rules are the comment at the top of the template topic, `apps/api/src/seed/content/informatics/01-variables.ts`, and `docs/04-data/data-model.md` (seed loader and deletion policy). Read both first. This checklist doesn't replace them.

## Safety rules (never bypass)

- Never mark a language `reviewed` unless a native speaker actually checked it. AI-drafted text stays `needs-review` in every language. Say "Drafted by Claude (AI)" in the file's header comment.
- Never change what a published question asks, which option is correct, or what an option means. Give the changed question a **new key**. Typo and translation fixes in place are fine.
- Never remove or rename topics, lessons, quizzes, questions, options, or resources. The loader never deletes and blocks orphaned or re-parented records.
- Don't edit `schema.prisma`, migrations, or the seed loader to make content fit. Propose a schema change to the owner instead.
- Don't run `pnpm db:seed` or `pnpm db:seed:demo` from this skill. Writing to the database needs the owner's explicit approval in the chat.

## New topic

1. Copy `01-variables.ts` to `informatics/NN-<slug>.ts` and export a `defineTopic(...)` constant.
2. Add it to the `topics` array in `apps/api/src/seed/content/index.ts`, in order.
3. Fill every field:
   - `slug`, `subject`, `order`, `title` and `summary` in `tg`, `ru`, `en`.
   - `prerequisites`: existing topic slugs only, no cycles. `map: { column, row }` for the topic map.
   - `review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' }`.
   - `lessons`: unique `slug`, `estimatedMinutes` (1–120), Markdown `body` in all three languages.
   - `resources`: real books or sites only. Check the title, author, and URL. Never invent a link. List only the languages the resource is actually available in.
   - `quiz`: unique `slug`, at least 3 questions (the existing topics use 4), each with exactly one correct option and an explanation in all three languages.

## Before writing

- Check the topic list and prerequisites in `docs/00-product/mvp-scope.md` (demo subject table). A new topic needs the owner's agreement if it isn't there.
- Prerequisites must form no cycle (`seed:check` enforces this). Also keep every prerequisite's `order` lower than its dependents' so topic order stays a valid study order; `seed:check` does not check that, so verify it by reading the `topics` array.

## Writing rules

- Python only for code (D-20). Code is identical in every language. Only comments and prose are translated.
- Code blocks use `~~~python … ~~~`. Escape inline-code backticks inside template strings as `` \` ``.
- Tajik uses Tajik Cyrillic letters (ӣ, ӯ, қ, ғ, ҳ, ҷ), not Russian substitutes.
- Every question has one clearly correct answer that the lesson teaches, plausible distractors, and an explanation of why. No "all of the above".

## Verify

1. `pnpm seed:check` (no database). Fix every reported error.
2. `pnpm --filter @nuvora/api test`. The full-content test in `apps/api/src/seed/load/seed-content.spec.ts` pins record counts (topics, lessons, questions, options). Update those counts on purpose when you add content, and say so in the report.
3. If the local database is running: `pnpm db:seed:dry-run` to preview the plan. It reads the database and writes nothing, so it needs no extra approval. If the plan reports a blocked change, stop and report it. Never work around the guard. If the database isn't available, say the dry run was not run.
4. Writing the content to the database (`pnpm db:seed`) is a separate step that needs the owner's explicit approval in the chat. Don't run it from this skill.

## Report

List the files changed, the topics, lessons, and questions added or edited, the review status per language (all `needs-review` unless a named native speaker checked them), the check results, and what still needs a Tajik and Russian review.
