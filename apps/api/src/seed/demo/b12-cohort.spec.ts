import { CheckpointContentSchema, TopicContentSchema } from '@nuvora/shared';
import { content } from '../content/index.js';
import { isScoringError, type ScoreResult, scoreAttempt } from '../../quizzes/scoring.js';
import { answersFromChoices, B12_DIAGNOSTIC_QUIZ, B12_RETEST_QUIZ, B12_STUDENTS } from './b12-cohort.js';

/**
 * Replays group B-12 through the real scoring code and checks the results against
 * the numbers in the Faroz handoff (demo-learner-teacher.json / demo-center.json).
 * If content or the cohort script drifts, the demo numbers would be wrong: this fails first.
 */
const diagnostic = CheckpointContentSchema.parse(content.checkpoints!.find((c) => c.slug === B12_DIAGNOSTIC_QUIZ));
const retest = TopicContentSchema.parse(content.topics.find((t) => t.quiz.slug === B12_RETEST_QUIZ)).quiz;

const diagnosticQuestions = diagnostic.questions.map((q) => ({
  key: q.key,
  topicSlug: q.topic,
  options: q.options.map((o) => ({ key: o.key, isCorrect: o.correct })),
}));
const retestQuestions = retest.questions.map((q) => ({
  key: q.key,
  topicSlug: 'js-arrays',
  options: q.options.map((o) => ({ key: o.key, isCorrect: o.correct })),
}));

const score = (questions: typeof diagnosticQuestions, answers: { questionKey: string; optionKey: string }[]): ScoreResult => {
  const result = scoreAttempt(questions, answers);
  if (isScoringError(result)) throw new Error(result.message);
  return result;
};

const submitted = B12_STUDENTS.filter((s) => s.diagnostic);
const results = submitted.map((s) => ({
  student: s,
  result: score(diagnosticQuestions, answersFromChoices(diagnosticQuestions.map((q) => q.key), s.diagnostic!)),
}));

describe('B-12 cohort replay matches the Faroz handoff numbers', () => {
  it('24 of 26 submitted the diagnostic', () => {
    expect(B12_STUDENTS).toHaveLength(26);
    expect(submitted).toHaveLength(24);
  });

  it('every student total matches the handoff', () => {
    const totals = [13, 9, 16, 16, 14, 9, 16, 20, 18, 18, 16, 19, 17, 5, 19, 18, 15, 4, 4, 8, 7, 16, 11, 20];
    expect(results.map((r) => r.result.correctCount)).toEqual(totals);
  });

  it('Amina Rahimova: 13/20, Arrays 1/4, Functions 2/4', () => {
    const amina = results.find((r) => r.student.slug === 'amina-rahimova')!.result;
    expect(amina.correctCount).toBe(13);
    expect(amina.scorePercent).toBe(65);
    expect(amina.topics.find((t) => t.topicSlug === 'js-arrays')).toMatchObject({ correctCount: 1, totalCount: 4 });
    expect(amina.topics.find((t) => t.topicSlug === 'js-functions')).toMatchObject({ correctCount: 2, totalCount: 4 });
  });

  it('topic totals: Variables 92 · Conditions 81 · Functions 58 · Arrays 44 · Objects 63; group 328/480, average 68%', () => {
    const totals = new Map<string, { ok: number; of: number }>();
    for (const { result } of results) {
      for (const t of result.topics) {
        const entry = totals.get(t.topicSlug) ?? { ok: 0, of: 0 };
        entry.ok += t.correctCount;
        entry.of += t.totalCount;
        totals.set(t.topicSlug, entry);
      }
    }
    expect(Object.fromEntries(totals)).toEqual({
      'js-variables': { ok: 88, of: 96 },
      'js-conditions': { ok: 97, of: 120 },
      'js-functions': { ok: 56, of: 96 },
      'js-arrays': { ok: 42, of: 96 },
      'js-objects': { ok: 45, of: 72 },
    });
    expect(results.reduce((n, r) => n + r.result.correctCount, 0)).toBe(328);
    expect(Math.round(results.reduce((n, r) => n + r.result.scorePercent, 0) / results.length)).toBe(68);
  });

  it('per-question correct counts match the handoff', () => {
    const counts = [23, 21, 20, 15, 18, 24, 14, 23, 9, 12, 21, 19, 21, 7, 13, 16, 10, 20, 11, 11];
    expect(diagnosticQuestions.map((q) => results.filter((r) => r.result.questions.find((x) => x.key === q.key)!.isCorrect).length)).toEqual(counts);
  });

  it('Arrays retest: 13 took it, per-question 13/9/5/6/11, Amina 4/5', () => {
    const retakers = B12_STUDENTS.filter((s) => s.retest);
    expect(retakers).toHaveLength(13);
    const wrongChoice = (q: (typeof retestQuestions)[number], correct: boolean) => q.options.find((o) => o.isCorrect === correct)!.key;
    const retestResults = retakers.map((s) =>
      score(retestQuestions, retestQuestions.map((q, i) => ({ questionKey: q.key, optionKey: wrongChoice(q, s.retest![i] === '1') }))),
    );
    expect(retestQuestions.map((q) => retestResults.filter((r) => r.questions.find((x) => x.key === q.key)!.isCorrect).length)).toEqual([13, 9, 5, 6, 11]);
    expect(retestResults[0].correctCount).toBe(4);
  });
});
