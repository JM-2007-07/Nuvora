import { CenterGroupSchema } from '@nuvora/shared';
import { DEMO_GROUPS, findGroup } from '../staff/demo-org.js';
import { centerSafeTotals, MIN_SUBMITTED_FOR_TOTALS, toCenterGroup } from './center-view.js';

const b12 = { students: 26, submitted: 24, answers: { ok: 328, of: 480 }, topics: [{ title: 'Variables', percent: 92 }, { title: 'Arrays', percent: 44 }] };

describe('center views (aggregates only, handoff CGroups numbers)', () => {
  it('B-12 from recorded aggregates: 26 students, 92% participation, 68% diagnostic, both flags', () => {
    const view = toCenterGroup(findGroup('B-12')!, b12);
    expect(view).toMatchObject({ students: 26, submitted: 24, participationPercent: 92, diagnosticPercent: 68, recorded: true, flags: ['TOPIC_UNDER_60', 'PARTICIPATION_UNDER_95'] });
  });

  it.each([
    ['B-14', 70, ['TOPIC_UNDER_60']],
    ['C-02', 75, ['TOPIC_UNDER_60']],
  ])('%s from handoff reference figures: diagnostic %i%%, flags %j', (code, diagnostic, flags) => {
    expect(toCenterGroup(findGroup(code as string)!, null)).toMatchObject({ diagnosticPercent: diagnostic, flags, recorded: false });
  });

  it('hides percentages when fewer than the privacy threshold submitted (one submitter reveals one score)', () => {
    const one = { students: 4, submitted: 1, answers: { ok: 15, of: 20 }, topics: [{ title: 'Arrays', percent: 75 }] };
    const view = toCenterGroup(findGroup('B-12')!, one);
    expect(view).toMatchObject({ students: 4, submitted: 1, diagnosticPercent: null, topics: null });
    expect(view.flags).not.toContain('TOPIC_UNDER_60');
    expect(centerSafeTotals({ submitted: MIN_SUBMITTED_FOR_TOTALS - 1, diagnosticPercent: 80 }).diagnosticPercent).toBeNull();
    expect(centerSafeTotals({ submitted: MIN_SUBMITTED_FOR_TOTALS, diagnosticPercent: 80 }).diagnosticPercent).toBe(80);
  });

  it('B-16 is flagged setup incomplete; B-09 (archived) has no flags', () => {
    expect(toCenterGroup(findGroup('B-16')!, null).flags).toEqual(['SETUP_INCOMPLETE']);
    expect(toCenterGroup(findGroup('B-09')!, null).flags).toEqual([]);
  });

  it('every view passes the strict schema, which has no per-student field', () => {
    for (const group of DEMO_GROUPS) {
      const view = CenterGroupSchema.parse(toCenterGroup(group, group.code === 'B-12' ? b12 : null));
      expect(Object.keys(view).sort()).toEqual(Object.keys(CenterGroupSchema.shape).sort());
      expect(JSON.stringify(view)).not.toMatch(/Amina|retest/);
    }
  });
});
