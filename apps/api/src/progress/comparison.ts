import type { QuizKind } from '@nuvora/shared';
import { percent } from '../quizzes/scoring.js';

/**
 * Before/after per topic (Faroz learner flow: diagnostic → practice → retest).
 * Pure: works on stored answers only, so what it shows is what was recorded.
 *
 * - before: the topic's score in the learner's FIRST checkpoint (diagnostic) attempt
 *   that covered it;
 * - after: the topic's score in the most recent LATER attempt that covered it
 *   (a topic quiz retest or a second diagnostic). Null until there is one.
 * Without any checkpoint attempt, `before` is null and `after` is the latest attempt.
 */

export interface StoredAnswer {
  attemptId: string;
  submittedAt: Date;
  quizSlug: string;
  quizKind: QuizKind;
  topicSlug: string;
  isCorrect: boolean;
}

export interface TopicAttemptScore {
  attemptId: string;
  quizSlug: string;
  quizKind: QuizKind;
  submittedAt: Date;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
}

export interface TopicComparison {
  before: TopicAttemptScore | null;
  after: TopicAttemptScore | null;
}

export function compareTopics(answers: StoredAnswer[]): Map<string, TopicComparison> {
  // Per attempt and topic: correct/total.
  const scores = new Map<string, TopicAttemptScore & { topicSlug: string }>();
  for (const a of answers) {
    const id = `${a.attemptId}/${a.topicSlug}`;
    let entry = scores.get(id);
    if (!entry) {
      entry = { attemptId: a.attemptId, quizSlug: a.quizSlug, quizKind: a.quizKind, submittedAt: a.submittedAt, topicSlug: a.topicSlug, correctCount: 0, totalCount: 0, scorePercent: 0 };
      scores.set(id, entry);
    }
    entry.totalCount++;
    if (a.isCorrect) entry.correctCount++;
  }

  const chronological = [...scores.values()].sort((x, y) => x.submittedAt.getTime() - y.submittedAt.getTime() || x.attemptId.localeCompare(y.attemptId));
  const byTopic = new Map<string, TopicAttemptScore[]>();
  for (const { topicSlug, ...score } of chronological) {
    score.scorePercent = percent(score.correctCount, score.totalCount);
    byTopic.set(topicSlug, [...(byTopic.get(topicSlug) ?? []), score]);
  }

  const result = new Map<string, TopicComparison>();
  for (const [topicSlug, list] of byTopic) {
    const beforeIndex = list.findIndex((s) => s.quizKind === 'CHECKPOINT');
    const later = beforeIndex === -1 ? list : list.slice(beforeIndex + 1);
    result.set(topicSlug, { before: beforeIndex === -1 ? null : list[beforeIndex], after: later.at(-1) ?? null });
  }
  return result;
}
