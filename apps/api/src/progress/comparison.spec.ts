import { compareTopics, type StoredAnswer } from './comparison.js';

const day = (d: number) => new Date(Date.UTC(2026, 9, d, 9));
const answers = (attemptId: string, d: number, quizSlug: string, quizKind: 'TOPIC' | 'CHECKPOINT', topicSlug: string, marks: string): StoredAnswer[] =>
  marks.split('').map((m) => ({ attemptId, submittedAt: day(d), quizSlug, quizKind, topicSlug, isCorrect: m === '1' }));

describe('compareTopics (before/after per topic)', () => {
  it('diagnostic then retest: Arrays 1/4 before, 4/5 after', () => {
    const result = compareTopics([
      ...answers('diag', 6, 'javascript-diagnostic', 'CHECKPOINT', 'js-arrays', '1000'),
      ...answers('diag', 6, 'javascript-diagnostic', 'CHECKPOINT', 'js-functions', '1100'),
      ...answers('retest', 13, 'js-arrays-quiz', 'TOPIC', 'js-arrays', '11101'),
    ]);
    expect(result.get('js-arrays')).toEqual({
      before: expect.objectContaining({ attemptId: 'diag', correctCount: 1, totalCount: 4, scorePercent: 25 }),
      after: expect.objectContaining({ attemptId: 'retest', quizKind: 'TOPIC', correctCount: 4, totalCount: 5, scorePercent: 80 }),
    });
    expect(result.get('js-functions')).toEqual({ before: expect.objectContaining({ correctCount: 2, totalCount: 4 }), after: null });
  });

  it('after is the latest later attempt; the first diagnostic stays the baseline', () => {
    const result = compareTopics([
      ...answers('retest-2', 20, 'js-arrays-quiz', 'TOPIC', 'js-arrays', '11111'),
      ...answers('diag-1', 6, 'javascript-diagnostic', 'CHECKPOINT', 'js-arrays', '0000'),
      ...answers('diag-2', 27, 'javascript-diagnostic', 'CHECKPOINT', 'js-arrays', '1110'),
      ...answers('retest-1', 13, 'js-arrays-quiz', 'TOPIC', 'js-arrays', '10000'),
    ]).get('js-arrays')!;
    expect(result.before?.attemptId).toBe('diag-1');
    expect(result.after).toEqual(expect.objectContaining({ attemptId: 'diag-2', scorePercent: 75 }));
  });

  it('a topic quiz taken before any diagnostic is not a baseline', () => {
    const result = compareTopics([
      ...answers('practice', 3, 'js-arrays-quiz', 'TOPIC', 'js-arrays', '11000'),
      ...answers('diag', 6, 'javascript-diagnostic', 'CHECKPOINT', 'js-arrays', '1000'),
    ]).get('js-arrays')!;
    expect(result.before?.attemptId).toBe('diag');
    expect(result.after).toBeNull();
  });

  it('without a diagnostic: no before, after = latest attempt', () => {
    const result = compareTopics([
      ...answers('a1', 3, 'js-arrays-quiz', 'TOPIC', 'js-arrays', '10000'),
      ...answers('a2', 4, 'js-arrays-quiz', 'TOPIC', 'js-arrays', '11000'),
    ]).get('js-arrays')!;
    expect(result).toEqual({ before: null, after: expect.objectContaining({ attemptId: 'a2', scorePercent: 40 }) });
  });

  it('no answers: empty', () => {
    expect(compareTopics([]).size).toBe(0);
  });
});
