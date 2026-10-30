# Engineering stories

A story is a short, dated record of a significant change: why it happened, what was decided, what was actually verified, and what is still open. Stories are the project's change log for people and agents. Decisions themselves still go in [decisions.md](../01-architecture/decisions.md) (and an [ADR](../01-architecture/adr/) when the trade-off needs explaining); a story links to them.

## When to write one

Write a story when a change does at least one of these:

- completes or advances a gate or a G4 sub-milestone ([roadmap](../05-planning/roadmap.md));
- changes behaviour, an API contract, the data model, seed content in bulk, or the build/verification tooling;
- adds or upgrades a dependency, or proposes/records a decision;
- fixes a regression that reached a demo-path page.

Don't write one for typos, single translation fixes, formatting, or small refactors. Group related small changes into the next story of the same area ("Content fixes after review" with a list), or into the story of the feature they belong to.

Stories are written **when the work happens**, never backfilled with invented history. Work done before 2026-10-26 is recorded in [decisions.md](../01-architecture/decisions.md), the roadmap, and git history.

## File name

`docs/stories/YYYY-MM-DD-short-description.md`, using the real date the work was done (local date). Kebab-case description, 3–6 words. Two stories on the same day get different descriptions, never a counter. Update an existing story when the same piece of work continues on a later day (add a dated "Update" section) rather than creating a near-duplicate.

## Template

```markdown
# YYYY-MM-DD: Title

Status: planned | in progress | implemented | verified   (pick one; say what is not verified)
Gate: G4-x   Requirements: FR-…   Decisions: D-…

## Context
Why this change, what problem or requirement it addresses.

## Decisions
What was decided, alternatives considered, links to decisions.md / ADRs.

## Changes
Files, components, or systems affected. Keep it to what a reviewer needs.

## Verification
Commands actually run and their real results (pass/fail/not run). Browser checks with viewport, locale, theme.

## Implications
Security, performance, accessibility, localization, architecture, design: only the ones that apply.

## Known limitations and follow-ups
Open items with a concrete next step and owner if known. Unresolved questions.
```

Keep planned, implemented, and verified apart. "Implemented" means the code exists; "verified" means named checks passed. A future feature is never described as done.

The `new-story` skill ([`.claude/skills/new-story/SKILL.md`](../../.claude/skills/new-story/SKILL.md)) creates and updates stories from the real diff and real check output.

## Index

| Date | Story | Status |
| --- | --- | --- |
| 2026-10-26 | [Harness engineering foundation](2026-10-26-harness-engineering-foundation.md) | verified (docs and tooling) |
| 2026-10-26 | [G4-B preparation: D-22, Motion, homepage brief](2026-10-26-g4b-motion-and-homepage-brief.md) | implemented and verified; redesign planned |
| 2026-10-26 | [Russian becomes the default interface language](2026-10-26-default-locale-russian.md) | implemented and verified |
| 2026-10-28 | [Faroz foundation (rebrand phase 1)](2026-10-28-faroz-foundation.md) | implemented and verified |
| 2026-10-28 | [Faroz homepage (rebrand phase 2)](2026-10-28-faroz-homepage.md) | implemented and verified |
| 2026-10-28 | [Defense audit, plan, and the learner slice](2026-10-28-defense-audit-and-plan.md) | learner slice implemented and verified; teacher, center, PWA planned |
| 2026-10-28 | [Teacher workspace (Faroz phase 4)](2026-10-28-teacher-workspace.md) | core implemented and verified; assessments, builder, assign practice not built |
| 2026-10-28 | [Center workspace (Faroz phase 5)](2026-10-28-center-workspace.md) | core implemented and verified; group wizard, invitations, permission editing not built |
| 2026-10-28 | [Defense readiness: PWA, QA, real vs prototype](2026-10-28-defense-readiness.md) | PWA implemented and verified; release QA partly run |
| 2026-10-29 | [Full site pass: accounts, every page wired, motion and hover](2026-10-29-full-site-pass.md) | implemented and verified |
| 2026-10-29 | [Teacher assessments list and builder](2026-10-29-teacher-assessments.md) | implemented and verified; learners taking them not built |
| 2026-10-29 | [Center teacher invitations and editable permissions](2026-10-29-center-invitations.md) | implemented and verified; group wizard not built |
| 2026-10-29 | [Center group wizard](2026-10-29-center-group-wizard.md) | implemented and verified; no group created in the real DB |
| 2026-10-29 | [Faroz Orbit hero](2026-10-29-faroz-orbit-hero.md) | implemented and verified |
| 2026-10-29 | [Handover for the next session](2026-10-29-handover.md) | handover (read first) |
| 2026-10-30 | [Site copy pass and the Faroz writing voice](2026-10-30-site-copy-voice.md) | implemented and verified; ru/tg need native review |
