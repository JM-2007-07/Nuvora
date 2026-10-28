# Vision and users

Status: **Approved** (product vision, as provided by the team). Target-user details: **Approved** (G0 baseline, owner, 2026-10-25).

## Vision

Nuvora is *a new horizon of knowledge, learning, and personal growth*: **Discover more. Become more.**

Nuvora helps people learn academic subjects through structured lessons and recommended books. Quizzes measure what they know, and the platform points out weak areas and **what to study next**. It is multilingual from day one: Tajik, Russian, and English.

## The core learning loop

```text
Choose a subject → Study a lesson → Take a quiz → See weak topics → Review recommended material → Track progress
        ↑                                                                                              │
        └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Every MVP feature exists to make this loop work end to end. Features that don't serve the loop are deferred. See [mvp-scope.md](mvp-scope.md).

## Target users

| User | Context | What they need from Nuvora |
| --- | --- | --- |
| **School and university students** (primary) | Studying a subject for class or exams, often on a phone | Clear lessons in their language, quick self-checks, a concrete "study this next" |
| **Self-learners** | Learning a subject outside formal education | A structured path through a subject and trusted book recommendations |
| **Teachers** (later) | Want to point students at material and see weak areas | Class-level views and content authoring. Not in the MVP. |

## Problems Nuvora solves

1. **Language access.** Good structured learning material is scarce in Tajik, and learners often switch between Tajik, Russian, and English sources.
2. **No feedback loop.** Learners read material but don't know what they haven't understood. Quizzes rarely explain answers or link back to what to review.
3. **No sense of structure.** Learners don't see how topics depend on each other, so they study advanced topics before the prerequisites.
4. **Scattered resources.** Good books and materials exist but aren't connected to the specific topic a learner is struggling with.
5. **Low motivation.** Progress is invisible, so it's easy to give up.

## How the features map to the problems

| Feature | Problem(s) |
| --- | --- |
| Subject and topic catalog, structured lessons | 3 |
| Recommended books and resources | 4 |
| Quizzes with scoring and explanations | 2 |
| Adaptive Quiz (weak-topic analysis and recommendations) | 2, 3, 4 |
| Knowledge Map | 3 |
| Learning progress and Learning Journey | 5 |
| Tajik / Russian / English interface and content | 1 |
| Light / dark / system appearance | comfort and accessibility |

## Product principles

- **Loop first.** A complete simple loop beats several half-built features.
- **Explain, don't just score.** Every quiz answer has an explanation, and every weak topic links to something to study.
- **Equal languages.** Tajik is a first-class language, not a translation afterthought.
- **Calm and premium.** The interface follows the brand: clear, modern, uncluttered. Motion supports understanding and never distracts.
