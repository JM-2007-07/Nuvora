import { DEFAULT_EXAM_POLICY } from '@nuvora/shared';
import { examWindow, initialDeadline, revealState, scoreAnswers, shuffled, violationOutcome } from './exam-rules.js';

const at = (iso: string) => new Date(iso);

describe('exam rules', () => {
  it('window: drafts are hidden; scheduled → open → closed by the clock', () => {
    const a = { publishedAt: at('2026-10-30T10:00:00Z'), opensAt: at('2026-10-31T10:00:00Z'), closesAt: at('2026-10-31T12:00:00Z') };
    expect(examWindow({ ...a, publishedAt: null }, at('2026-10-31T11:00:00Z'))).toBeNull();
    expect(examWindow(a, at('2026-10-31T09:59:59Z'))).toBe('scheduled');
    expect(examWindow(a, at('2026-10-31T11:00:00Z'))).toBe('open');
    expect(examWindow(a, at('2026-10-31T12:00:00Z'))).toBe('closed');
    expect(examWindow({ ...a, opensAt: null, closesAt: null }, at('2030-01-01T00:00:00Z'))).toBe('open');
  });

  it('deadline: the time limit, capped by the closing time; none without either', () => {
    const start = at('2026-10-31T11:30:00Z');
    expect(initialDeadline(start, 20, at('2026-10-31T13:00:00Z'))).toEqual(at('2026-10-31T11:50:00Z'));
    expect(initialDeadline(start, 60, at('2026-10-31T12:00:00Z'))).toEqual(at('2026-10-31T12:00:00Z'));
    expect(initialDeadline(start, null, null)).toBeNull();
  });

  it('shuffle keeps every item exactly once', () => {
    const out = shuffled([1, 2, 3, 4, 5, 6]);
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(shuffled(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
  });

  it('default policy: 1st → warning, 2nd → teacher notified, 3rd → flagged, later → recorded', () => {
    expect([1, 2, 3, 4].map((n) => violationOutcome(DEFAULT_EXAM_POLICY, n))).toEqual(['warning', 'teacher-notified', 'flagged', 'recorded']);
    expect(violationOutcome({ ...DEFAULT_EXAM_POLICY, action: 'END' }, 3)).toBe('ended');
    expect(violationOutcome({ ...DEFAULT_EXAM_POLICY, action: 'PAUSE', warnAfter: 2, notifyAfter: 3, actionAfter: 5 }, 1)).toBe('recorded');
    expect(violationOutcome({ ...DEFAULT_EXAM_POLICY, action: 'PAUSE', warnAfter: 2, notifyAfter: 3, actionAfter: 5 }, 5)).toBe('paused');
  });

  it('reveal follows the setting', () => {
    const closes = at('2026-10-31T12:00:00Z');
    expect(revealState('AFTER_SUBMIT', closes, at('2026-10-31T11:00:00Z')).revealed).toBe(true);
    expect(revealState('AFTER_CLOSE', closes, at('2026-10-31T11:00:00Z'))).toEqual({ revealed: false, revealAt: closes });
    expect(revealState('AFTER_CLOSE', closes, at('2026-10-31T12:00:00Z')).revealed).toBe(true);
    expect(revealState('NEVER', closes, at('2027-01-01T00:00:00Z')).revealed).toBe(false);
  });

  it('scores from stored correctness; unanswered is wrong', () => {
    const r = scoreAnswers([{ id: 'q1', correctIndex: 0 }, { id: 'q2', correctIndex: 2 }, { id: 'q3', correctIndex: 1 }], new Map([['q1', 0], ['q2', 1]]));
    expect(r).toMatchObject({ correct: 1, total: 3, percent: 33 });
    expect([...r.perQuestion.values()]).toEqual([true, false, false]);
  });
});
