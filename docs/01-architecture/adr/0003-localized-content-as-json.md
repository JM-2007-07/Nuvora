# ADR-0003: Store localized content as JSON locale maps

- Status: **Approved** (decision D-04, G0, owner, 2026-10-25)
- Date: 2026-10-25

## Context

Subjects, topics, lessons, questions, options, explanations, and resource descriptions all need text in Tajik, Russian, and English. There are two common approaches:

1. **Translation tables:** e.g. `Lesson` + `LessonTranslation(lessonId, locale, title, body)`.
2. **JSON locale maps:** e.g. `Lesson.title = { "tg": "…", "ru": "…", "en": "…" }` in a `jsonb` column.

## Decision

Use **JSON locale maps** (`LocalizedText`) for the MVP.

- Shared Zod schema: `LocalizedText = { tg?: string; ru?: string; en?: string }` with at least one locale. A stricter seed rule requires all three for core demo content (D-06).
- The API resolves a `LocalizedText` to a single string for the requested locale, applies the [fallback order](../architecture.md#content-fallback-strategy), and lists the fields that fell back in `fallbackFields`.
- Seed files are validated against the schema before insert.

## Consequences

**Positive**
- About half the tables and joins. Seed files stay readable: all three translations sit side by side, which makes review easier.
- Adding a fourth language later needs no migration.

**Negative**
- Prisma types `jsonb` as `JsonValue`, so we must always parse with Zod (in one helper).
- Can't easily query "all lessons missing a Tajik translation" in SQL. A seed-time script reports missing translations instead.
- Full-text search per language is harder. Search is out of MVP scope. Revisit with translation tables if search or per-locale publishing becomes necessary.
