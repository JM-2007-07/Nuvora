# ADR-0004: Rule-based mastery and recommendations

- Status: **Approved** (decision D-13, G0, owner, 2026-10-25). The thresholds below are starting values to tune with real content.
- Date: 2026-10-25

## Context

The "Adaptive Quiz" must identify weak topics and recommend what to review. With one subject, a few dozen questions, and no learner data, a statistical or ML model can't be trained or validated. The result must also be **explainable** to the learner ("why am I seeing this?").

## Decision

### Topic score per attempt

Every question belongs to exactly one topic. For an attempt, `topicScore = correct answers in topic / questions in topic` (0–100%).

### Mastery (per learner, per topic)

- Mastery is based on the learner's **most recent attempt that included the topic**. It is stored in `TopicMastery` so pages don't recompute it.
- Status bands:

| Status | Rule |
| --- | --- |
| `NOT_STARTED` | No attempt has included this topic |
| `WEAK` | score < 60% |
| `DEVELOPING` | 60% ≤ score < 80% |
| `MASTERED` | score ≥ 80% |

- Quizzes should have **at least 3 questions per topic** so one lucky or unlucky answer doesn't swing the status. This is a content rule enforced by a seed check.

### Recommendations (after each attempt; max 3)

1. Take the topics that are `WEAK` in this attempt, lowest score first.
2. For each weak topic, first add every **direct prerequisite** that is `WEAK` or `NOT_STARTED` (weak before not started, then in subject order), recommending its lesson. Reason: "Prerequisite for <topic>".
3. Then add the weak topic itself: its lesson, or, if the learner already completed that lesson, the topic's first recommended resource (e.g. a book chapter). Reason: "You scored N% on <topic>".
4. Remove duplicates and stop at 3. If nothing is weak, recommend the next topic in subject order that isn't `MASTERED`.

Worked example (the demo storyline in [mvp-scope.md](../../00-product/mvp-scope.md#demo-storyline-scripted-verified-on-friday)): Conditions is `WEAK`, and the learner completed the Loops lesson and then scored 50% on the Loops quiz. The result is **1. Conditions lesson** ("Prerequisite for Loops"), then **2. the recommended Loops book** ("You scored 50% on Loops").

All of this is a pure function `(attemptTopicScores, masteryByTopic, prerequisites, lessonProgress, resources) → Recommendation[]`, unit-tested with fixtures.

## Consequences

- Deterministic, easy to explain, and fast to build and test.
- Not adaptive in the psychometric sense. We say so honestly ([mvp-scope.md](../../00-product/mvp-scope.md#explicit-non-promises-for-october-31)).
- Later options: weight recent attempts, add question difficulty, use adaptive question selection (FR-ADAPT-04).
