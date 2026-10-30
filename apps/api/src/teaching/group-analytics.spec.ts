import { CheckpointContentSchema, TopicContentSchema } from '@nuvora/shared';
import { content } from '../seed/content/index.js';
import { answersFromChoices, B12_DIAGNOSTIC_QUIZ, B12_RETEST_QUIZ, B12_STUDENTS } from '../seed/demo/b12-cohort.js';
import { groupAnalytics, type StoredAttempt } from './group-analytics.js';

/** B-12 replayed as stored attempts; the results must match the Faroz handoff (TDashboard, TInsights). */
const diagnostic = CheckpointContentSchema.parse(content.checkpoints!.find((c) => c.slug === B12_DIAGNOSTIC_QUIZ));
const retestQuiz = TopicContentSchema.parse(content.topics.find((t) => t.quiz.slug === B12_RETEST_QUIZ)).quiz;
const questions = diagnostic.questions.map((q) => ({
  key: q.key,
  topicSlug: q.topic,
  prompt: q.prompt.en,
  options: q.options.map((o) => ({ key: o.key, text: o.text.en, isCorrect: o.correct })),
}));

const attempts: StoredAttempt[] = B12_STUDENTS.flatMap((s, i) => {
  const list: StoredAttempt[] = [];
  if (s.diagnostic) {
    const answers = answersFromChoices(questions.map((q) => q.key), s.diagnostic).map((a) => {
      const q = questions.find((x) => x.key === a.questionKey)!;
      return { ...a, topicSlug: q.topicSlug, isCorrect: q.options.find((o) => o.key === a.optionKey)!.isCorrect };
    });
    list.push({ id: `d${i}`, studentSlug: s.slug, quizSlug: B12_DIAGNOSTIC_QUIZ, quizKind: 'CHECKPOINT', topicSlug: null, submittedAt: new Date(Date.UTC(2026, 9, 6, 9, i)), answers });
  }
  if (s.retest) {
    const answers = retestQuiz.questions.map((q, n) => {
      const isCorrect = s.retest![n] === '1';
      return { questionKey: q.key, topicSlug: 'js-arrays', optionKey: q.options.find((o) => o.correct === isCorrect)!.key, isCorrect };
    });
    list.push({ id: `r${i}`, studentSlug: s.slug, quizSlug: B12_RETEST_QUIZ, quizKind: 'TOPIC', topicSlug: 'js-arrays', submittedAt: new Date(Date.UTC(2026, 9, 13, 10, i)), answers });
  }
  return list;
});

const result = groupAnalytics(B12_STUDENTS.map((s) => s.slug), { slug: B12_DIAGNOSTIC_QUIZ, questions }, attempts);

describe('groupAnalytics on B-12 (handoff numbers)', () => {
  it('24 of 26 submitted; average 68%; 328/480 answers correct', () => {
    expect(result.submitted).toBe(24);
    expect(result.averagePercent).toBe(68);
    expect(result.total).toEqual({ correct: 328, total: 480, percent: 68 });
    expect(result.students.filter((s) => !s.submitted).map((s) => s.slug)).toEqual(['daler-saidov', 'sofia-ivanova']);
  });

  it('topic totals 92 · 81 · 58 · 44 · 63', () => {
    expect(Object.fromEntries(result.topics.map((t) => [t.topicSlug, t.score.percent]))).toEqual({
      'js-variables': 92,
      'js-conditions': 81,
      'js-functions': 58,
      'js-arrays': 44,
      'js-objects': 63,
    });
  });

  it('Q14: 7/24 correct, 14 chose [2, 4, 6]', () => {
    const q14 = result.questions.find((q) => q.key === 'q14')!;
    expect(q14).toMatchObject({ number: 14, correct: 7, answered: 24, topicSlug: 'js-arrays' });
    expect(q14.chosen).toEqual({ a: 14, b: 1, c: 7, d: 2 });
  });

  it('Arrays retest: 13 takers, scan 19% → retest 68%, per question 13/9/5/6/11, closed Oct 13', () => {
    expect(result.retest).toMatchObject({
      quizSlug: B12_RETEST_QUIZ,
      topicSlug: 'js-arrays',
      takers: 13,
      before: { correct: 10, total: 52, percent: 19 },
      after: { correct: 44, total: 65, percent: 68 },
    });
    expect(result.retest!.questions.map((q) => q.correct)).toEqual([13, 9, 5, 6, 11]);
    expect(result.retest!.closedAt.toISOString().slice(0, 10)).toBe('2026-10-13');
  });

  it('Amina: 13/20, Arrays 1/4 on the scan, 4/5 on the retest', () => {
    const amina = result.students.find((s) => s.slug === 'amina-rahimova')!;
    expect(amina.score).toEqual({ correct: 13, total: 20, percent: 65 });
    expect(amina.topics['js-arrays']).toEqual({ correct: 1, total: 4, percent: 25 });
    expect(amina.retest?.score).toEqual({ correct: 4, total: 5, percent: 80 });
  });

  it('ignores attempts of learners outside the roster and a retest taken before the diagnostic', () => {
    const outsider: StoredAttempt = { ...attempts[0], id: 'x', studentSlug: 'guest-x' };
    const early: StoredAttempt = { ...attempts[1], id: 'early', studentSlug: 'madina-yusupova', submittedAt: new Date(Date.UTC(2026, 9, 1)) };
    const again = groupAnalytics(B12_STUDENTS.map((s) => s.slug), { slug: B12_DIAGNOSTIC_QUIZ, questions }, [...attempts, outsider, early]);
    expect(again.submitted).toBe(24);
    expect(again.retest?.takers).toBe(13);
  });
});
