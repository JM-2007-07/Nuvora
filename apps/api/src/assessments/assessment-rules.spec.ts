import { type AssessmentDraft, assessmentChecks, canPublish, type DraftQuestion, questionProblem } from '@nuvora/shared';
import { assessmentStatus, defaultSchedule, sortRows, splitCode } from './assessment-rules.js';

const at = (iso: string) => new Date(iso);
const text = (en: string, ru = '', tg = '') => ({ en, ru, tg });
const question = (over: Partial<DraftQuestion> = {}): DraftQuestion => ({
  topicSlug: 'js-functions',
  source: null,
  prompt: text('What does f() return?', 'Что вернёт f()?', 'f() чӣ бармегардонад?'),
  code: 'function f(x = 2) {\n  return x * 3;\n}',
  options: [text('NaN'), text('6'), text('undefined')],
  correctIndex: 1,
  explanation: text('The default 2 is used.'),
  ...over,
});
const draft = (over: Partial<AssessmentDraft> = {}): AssessmentDraft => ({
  title: 'Functions — return vs console.log',
  groupCode: 'B-12',
  topicSlug: 'js-functions',
  purpose: 'CHECK',
  description: '',
  languages: ['ru', 'tg'],
  audience: 'CLASS',
  opensAt: '2026-11-03T16:00:00+05:00',
  closesAt: '2026-11-05T20:00:00+05:00',
  timeLimitMinutes: null,
  attemptsAllowed: 1,
  revealAnswers: 'AFTER_CLOSE',
  xp: 40,
  shuffleQuestions: true,
  shuffleOptions: true,
  notifyStudents: true,
  questions: [question(), question(), question()],
  ...over,
});

describe('assessmentStatus', () => {
  const published = { publishedAt: at('2026-10-29T10:00:00Z'), opensAt: at('2026-11-03T11:00:00Z'), closesAt: at('2026-11-05T15:00:00Z') };

  it('is a draft until published, even with dates', () => {
    expect(assessmentStatus({ ...published, publishedAt: null }, at('2026-11-04T00:00:00Z'))).toBe('draft');
  });

  it('is scheduled before it opens, live while open, closed from the close time', () => {
    expect(assessmentStatus(published, at('2026-11-03T10:59:59Z'))).toBe('scheduled');
    expect(assessmentStatus(published, at('2026-11-03T11:00:00Z'))).toBe('live');
    expect(assessmentStatus(published, at('2026-11-05T15:00:00Z'))).toBe('closed');
  });
});

describe('defaultSchedule', () => {
  it('opens tomorrow at 16:00 and closes two days later at 20:00', () => {
    const { opensAt, closesAt } = defaultSchedule(new Date(2026, 9, 29, 13, 30));
    expect([opensAt.getDate(), opensAt.getHours(), opensAt.getMinutes()]).toEqual([30, 16, 0]);
    expect([closesAt.getMonth(), closesAt.getDate(), closesAt.getHours()]).toEqual([10, 1, 20]);
  });
});

describe('splitCode', () => {
  it('moves a trailing ~~~js block into code', () => {
    expect(splitCode('What does this return?\n\n~~~js\n[1, 2].map(x => x * 2)\n~~~')).toEqual({ text: 'What does this return?', code: '[1, 2].map(x => x * 2)' });
  });

  it('keeps prompts without code unchanged', () => {
    expect(splitCode('Which keyword declares a constant?')).toEqual({ text: 'Which keyword declares a constant?', code: '' });
  });
});

describe('publish checks (shared with the builder)', () => {
  it('a complete draft can be published; missing translations only warn', () => {
    const d = draft({ questions: [question(), question(), question({ prompt: text('What does show("hi") return?') })] });
    expect(canPublish(d)).toBe(true);
    expect(assessmentChecks(d).filter((c) => c.code === 'TRANSLATION')).toEqual([
      { code: 'TRANSLATION', ok: false, blocking: false, locale: 'ru', count: 1 },
      { code: 'TRANSLATION', ok: false, blocking: false, locale: 'tg', count: 1 },
    ]);
  });

  it.each([
    ['no title', draft({ title: '  ' }), 'TITLE'],
    ['fewer than 3 questions', draft({ questions: [question(), question()] }), 'MIN_QUESTIONS'],
    ['a question without a correct answer', draft({ questions: [question(), question(), question({ correctIndex: 5 })] }), 'QUESTIONS_VALID'],
    ['close before open', draft({ closesAt: '2026-11-02T10:00:00+05:00' }), 'SCHEDULE'],
    ['no dates', draft({ opensAt: null }), 'SCHEDULE'],
  ])('blocks publishing with %s', (_label, d, code) => {
    expect(canPublish(d)).toBe(false);
    expect(assessmentChecks(d).find((c) => !c.ok && c.blocking)?.code).toBe(code);
  });

  it('names what is wrong with one question', () => {
    expect(questionProblem(question({ prompt: text('') }))).toBe('NO_PROMPT');
    expect(questionProblem(question({ options: [text('6'), text(' ')] }))).toBe('FEW_OPTIONS');
    expect(questionProblem(question({ options: [text('NaN'), text(''), text('6')], correctIndex: 1 }))).toBe('NO_CORRECT');
    expect(questionProblem(question())).toBeNull();
  });
});

describe('sortRows', () => {
  it('lists drafts, live, scheduled, then closed newest first', () => {
    const row = (id: string, status: 'draft' | 'live' | 'scheduled' | 'closed', closesAt: string | null) =>
      ({ id, status, closesAt, opensAt: null, updatedAt: null }) as Parameters<typeof sortRows>[0][number];
    const sorted = sortRows([row('old', 'closed', '2026-10-06'), row('d', 'draft', null), row('new', 'closed', '2026-10-13'), row('s', 'scheduled', null), row('l', 'live', '2026-10-16')]);
    expect(sorted.map((r) => r.id)).toEqual(['d', 'l', 's', 'new', 'old']);
  });
});
