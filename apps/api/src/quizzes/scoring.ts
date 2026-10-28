/**
 * Server-side quiz scoring (FR-QUIZ-02). Pure: no I/O. Correctness is read only
 * from stored options, never from the client.
 */

export interface ScorableQuestion {
  key: string;
  topicSlug: string;
  options: { key: string; isCorrect: boolean }[];
}

export interface SubmittedAnswer {
  questionKey: string;
  optionKey: string;
}

export type ScoringError =
  | { code: 'QUIZ_INCOMPLETE'; message: string }
  | { code: 'UNKNOWN_QUESTION'; message: string }
  | { code: 'DUPLICATE_ANSWER'; message: string }
  | { code: 'OPTION_NOT_IN_QUESTION'; message: string };

export interface ScoredQuestion {
  key: string;
  topicSlug: string;
  selectedOptionKey: string;
  correctOptionKey: string;
  isCorrect: boolean;
}

export interface ScoreResult {
  questions: ScoredQuestion[];
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  /** Per topic covered by the quiz, in first-appearance order. */
  topics: { topicSlug: string; correctCount: number; totalCount: number; scorePercent: number }[];
}

export const percent = (correct: number, total: number) => (total === 0 ? 0 : Math.round((correct / total) * 100));

/** Every question must be answered exactly once with one of its own options. */
export function scoreAttempt(questions: ScorableQuestion[], answers: SubmittedAnswer[]): ScoreResult | ScoringError {
  const byKey = new Map(questions.map((q) => [q.key, q]));
  const chosen = new Map<string, string>();
  for (const answer of answers) {
    const question = byKey.get(answer.questionKey);
    if (!question) return { code: 'UNKNOWN_QUESTION', message: `Question "${answer.questionKey}" is not part of this quiz` };
    if (chosen.has(answer.questionKey)) return { code: 'DUPLICATE_ANSWER', message: `Question "${answer.questionKey}" was answered twice` };
    if (!question.options.some((o) => o.key === answer.optionKey)) {
      return { code: 'OPTION_NOT_IN_QUESTION', message: `Option "${answer.optionKey}" does not belong to question "${answer.questionKey}"` };
    }
    chosen.set(answer.questionKey, answer.optionKey);
  }
  const missing = questions.filter((q) => !chosen.has(q.key)).map((q) => q.key);
  if (missing.length) return { code: 'QUIZ_INCOMPLETE', message: `Unanswered questions: ${missing.join(', ')}` };

  const scored = questions.map((q) => {
    const correctOptionKey = q.options.find((o) => o.isCorrect)?.key ?? '';
    const selectedOptionKey = chosen.get(q.key)!;
    return { key: q.key, topicSlug: q.topicSlug, selectedOptionKey, correctOptionKey, isCorrect: selectedOptionKey === correctOptionKey };
  });

  const topics: ScoreResult['topics'] = [];
  for (const q of scored) {
    let entry = topics.find((t) => t.topicSlug === q.topicSlug);
    if (!entry) topics.push((entry = { topicSlug: q.topicSlug, correctCount: 0, totalCount: 0, scorePercent: 0 }));
    entry.totalCount++;
    if (q.isCorrect) entry.correctCount++;
  }
  for (const t of topics) t.scorePercent = percent(t.correctCount, t.totalCount);

  const correctCount = scored.filter((q) => q.isCorrect).length;
  return { questions: scored, correctCount, totalCount: scored.length, scorePercent: percent(correctCount, scored.length), topics };
}

export function isScoringError(value: ScoreResult | ScoringError): value is ScoringError {
  return 'code' in value;
}
