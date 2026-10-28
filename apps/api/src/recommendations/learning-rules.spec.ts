import { masteryStatus } from '../progress/mastery.js';
import { isScoringError, scoreAttempt } from '../quizzes/scoring.js';
import { recommend, type TopicState } from './recommend.js';

const question = (key: string, topicSlug: string, correct = 'b') => ({
  key,
  topicSlug,
  options: ['a', 'b', 'c', 'd'].map((k) => ({ key: k, isCorrect: k === correct })),
});

describe('scoring (server-side, FR-QUIZ-02)', () => {
  const quiz = [question('q1', 'loops'), question('q2', 'loops'), question('q3', 'loops'), question('q4', 'loops')];

  it('scores from stored correctness and breaks down per topic', () => {
    const result = scoreAttempt(quiz, [
      { questionKey: 'q1', optionKey: 'b' },
      { questionKey: 'q2', optionKey: 'a' },
      { questionKey: 'q3', optionKey: 'b' },
      { questionKey: 'q4', optionKey: 'c' },
    ]);
    expect(isScoringError(result)).toBe(false);
    expect(result).toMatchObject({ correctCount: 2, totalCount: 4, scorePercent: 50, topics: [{ topicSlug: 'loops', correctCount: 2, totalCount: 4, scorePercent: 50 }] });
    expect(!isScoringError(result) && result.questions[1]).toEqual({ key: 'q2', topicSlug: 'loops', selectedOptionKey: 'a', correctOptionKey: 'b', isCorrect: false });
  });

  it('splits a multi-topic quiz by topic', () => {
    const result = scoreAttempt([question('a1', 'variables'), question('b1', 'loops'), question('b2', 'loops')], [
      { questionKey: 'a1', optionKey: 'b' },
      { questionKey: 'b1', optionKey: 'b' },
      { questionKey: 'b2', optionKey: 'a' },
    ]);
    expect(!isScoringError(result) && result.topics).toEqual([
      { topicSlug: 'variables', correctCount: 1, totalCount: 1, scorePercent: 100 },
      { topicSlug: 'loops', correctCount: 1, totalCount: 2, scorePercent: 50 },
    ]);
  });

  it.each([
    [[{ questionKey: 'q1', optionKey: 'b' }], 'QUIZ_INCOMPLETE'],
    [[...['q1', 'q2', 'q3', 'q4'].map((k) => ({ questionKey: k, optionKey: 'a' })), { questionKey: 'zz', optionKey: 'a' }], 'UNKNOWN_QUESTION'],
    [[{ questionKey: 'q1', optionKey: 'a' }, { questionKey: 'q1', optionKey: 'b' }], 'DUPLICATE_ANSWER'],
    [[{ questionKey: 'q1', optionKey: 'z' }], 'OPTION_NOT_IN_QUESTION'],
  ])('rejects invalid submissions: %#', (answers, code) => {
    const result = scoreAttempt(quiz, answers);
    expect(isScoringError(result) && result.code).toBe(code);
  });
});

describe('mastery bands (ADR-0004)', () => {
  it.each([
    [0, 'WEAK'], [50, 'WEAK'], [59, 'WEAK'], [60, 'DEVELOPING'], [75, 'DEVELOPING'], [79, 'DEVELOPING'], [80, 'MASTERED'], [100, 'MASTERED'],
  ] as const)('%i%% → %s', (score, status) => {
    expect(masteryStatus(score)).toBe(status);
  });
});

describe('recommendations (ADR-0004)', () => {
  // The approved Informatics graph.
  const base = (overrides: Partial<Record<string, Partial<TopicState>>> = {}): TopicState[] =>
    (
      [
        ['variables', 1, []],
        ['conditions', 2, ['variables']],
        ['functions', 3, ['variables']],
        ['loops', 4, ['conditions']],
        ['lists', 5, ['loops']],
        ['algorithms', 6, ['functions', 'lists']],
      ] as const
    ).map(([slug, order, prerequisites]) => ({
      slug,
      order,
      prerequisites: [...prerequisites],
      status: 'NOT_STARTED',
      scorePercent: null,
      lessonSlug: `${slug}-lesson`,
      lessonCompleted: false,
      firstResourceKey: `${slug}-book`,
      ...overrides[slug],
    }));

  it('demo storyline: weak prerequisite first, then the book for a weak topic whose lesson is done', () => {
    const topics = base({
      variables: { status: 'MASTERED', scorePercent: 100 },
      conditions: { status: 'WEAK', scorePercent: 50 },
      loops: { status: 'WEAK', scorePercent: 50, lessonCompleted: true },
    });
    expect(recommend(topics, [{ slug: 'loops', scorePercent: 50 }])).toEqual([
      { reason: 'PREREQUISITE', topicSlug: 'conditions', forTopicSlug: 'loops', target: { kind: 'LESSON', slug: 'conditions-lesson' } },
      { reason: 'WEAK_TOPIC', topicSlug: 'loops', scorePercent: 50, target: { kind: 'RESOURCE', key: 'loops-book' } },
    ]);
  });

  it('weak prerequisites come before not-started ones, and the list stops at 3', () => {
    const topics = base({ functions: { status: 'WEAK', scorePercent: 25 }, lists: { status: 'NOT_STARTED' }, algorithms: { status: 'WEAK', scorePercent: 0 } });
    expect(recommend(topics, [{ slug: 'algorithms', scorePercent: 0 }]).map((r) => `${r.reason}:${r.topicSlug}`)).toEqual([
      'PREREQUISITE:functions',
      'PREREQUISITE:lists',
      'WEAK_TOPIC:algorithms',
    ]);
  });

  it('mastered or developing prerequisites are not recommended', () => {
    const topics = base({ variables: { status: 'DEVELOPING', scorePercent: 75 }, conditions: { status: 'WEAK', scorePercent: 25 } });
    expect(recommend(topics, [{ slug: 'conditions', scorePercent: 25 }])).toEqual([
      { reason: 'WEAK_TOPIC', topicSlug: 'conditions', scorePercent: 25, target: { kind: 'LESSON', slug: 'conditions-lesson' } },
    ]);
  });

  it('several weak topics: lowest score first, no duplicates', () => {
    const topics = base({ variables: { status: 'MASTERED' }, conditions: { status: 'WEAK', scorePercent: 50 }, functions: { status: 'WEAK', scorePercent: 25 } });
    const recs = recommend(topics, [{ slug: 'conditions', scorePercent: 50 }, { slug: 'functions', scorePercent: 25 }]);
    expect(recs.map((r) => r.topicSlug)).toEqual(['functions', 'conditions']);
  });

  it('nothing weak: suggests the next topic that is not mastered', () => {
    const topics = base({ variables: { status: 'MASTERED' }, conditions: { status: 'MASTERED' } });
    expect(recommend(topics, [])).toEqual([{ reason: 'NEXT_TOPIC', topicSlug: 'functions', target: { kind: 'LESSON', slug: 'functions-lesson' } }]);
  });

  it('everything mastered: nothing to recommend', () => {
    expect(recommend(base(Object.fromEntries(['variables', 'conditions', 'functions', 'loops', 'lists', 'algorithms'].map((s) => [s, { status: 'MASTERED' as const }]))), [])).toEqual([]);
  });
});
