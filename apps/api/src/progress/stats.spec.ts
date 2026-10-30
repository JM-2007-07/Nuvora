import { computeStats } from './stats.js';

const at = (iso: string) => new Date(`${iso}T10:00:00Z`);

describe('computeStats (XP, level, streak, badges from stored activity)', () => {
  it('Amina: diagnostic 13/20 on Oct 6, retest 4/5 on Oct 13, Arrays 25% → 80%', () => {
    const stats = computeStats(
      {
        attempts: [
          { submittedAt: at('2026-10-06'), correctCount: 13, kind: 'CHECKPOINT' },
          { submittedAt: at('2026-10-13'), correctCount: 4, kind: 'TOPIC' },
        ],
        lessons: [],
        comparisons: [{ beforePercent: 25, afterPercent: 80, afterAt: at('2026-10-13') }],
      },
      at('2026-10-14'),
    );
    expect(stats).toMatchObject({ xp: 170, level: 1, levelStart: 0, levelEnd: 200, streakDays: 1, activeDays: ['2026-10-13', '2026-10-06'] });
    expect(stats.badges).toEqual([
      { code: 'FIRST_SCAN', earned: true, earnedAt: '2026-10-06T10:00:00.000Z' },
      { code: 'GAP_CLOSER', earned: true, earnedAt: '2026-10-13T10:00:00.000Z' },
      { code: 'BOOKWORM', earned: false, earnedAt: null },
      { code: 'STREAK_3', earned: false, earnedAt: null },
    ]);
  });

  it('streak counts consecutive days ending today or yesterday; lessons count as activity and XP', () => {
    const stats = computeStats(
      {
        attempts: [{ submittedAt: at('2026-10-26'), correctCount: 3, kind: 'TOPIC' }],
        lessons: [{ completedAt: at('2026-10-27') }, { completedAt: at('2026-10-28') }, { completedAt: at('2026-10-20') }],
        comparisons: [],
      },
      at('2026-10-28'),
    );
    expect(stats.xp).toBe(30 + 60);
    expect(stats.streakDays).toBe(3);
    expect(stats.badges.find((b) => b.code === 'STREAK_3')).toEqual({ code: 'STREAK_3', earned: true, earnedAt: '2026-10-28T00:00:00.000Z' });
    expect(stats.badges.find((b) => b.code === 'BOOKWORM')?.earned).toBe(true);
  });

  it('a gap stays open unless the later score reaches 80%', () => {
    const stats = computeStats({ attempts: [], lessons: [], comparisons: [{ beforePercent: 40, afterPercent: 60, afterAt: at('2026-10-10') }] }, at('2026-10-28'));
    expect(stats.badges.find((b) => b.code === 'GAP_CLOSER')?.earned).toBe(false);
    expect(stats).toMatchObject({ xp: 0, level: 1, streakDays: 0, activeDays: [] });
  });

  it('level 2 starts at 200 XP', () => {
    const stats = computeStats({ attempts: [{ submittedAt: at('2026-10-01'), correctCount: 20, kind: 'CHECKPOINT' }], lessons: [], comparisons: [] }, at('2026-10-28'));
    expect(stats).toMatchObject({ xp: 200, level: 2, levelStart: 200, levelEnd: 400 });
  });
});
