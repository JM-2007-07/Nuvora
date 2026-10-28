import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CenterGroupDetail, CenterOverview, CenterSettings, CenterStaff, GroupAnalytics, Locale } from '@nuvora/shared';
import { DEMO_GROUPS, type DemoGroup, type DemoStaff, findGroup, PERMISSION_DEFAULTS, STAFF_DIRECTORY } from '../staff/demo-org.js';
import { toStaff } from '../staff/staff.controller.js';
import { TeachingService } from '../teaching/teaching.service.js';
import { type GroupAggregate, toCenterGroup } from './center-view.js';

const ORGANIZATION = 'Faroz Demo Center';

/** Reduces full analytics to group totals; individual scores never leave this function. */
function aggregate(full: GroupAnalytics): GroupAggregate {
  return {
    students: full.group.studentCount,
    submitted: full.group.submitted,
    answers: { ok: full.topics.reduce((n, t) => n + t.score.correct, 0), of: full.topics.reduce((n, t) => n + t.score.total, 0) },
    topics: full.topics.map((t) => ({ title: t.topic.title, percent: t.score.percent })),
  };
}

/** Center workspace (handoff CDashboard, CGroups, CStaff, CSettings): group totals and participation only. */
@Injectable()
export class CenterService {
  constructor(@Inject(TeachingService) private readonly teaching: TeachingService) {}

  async overview(staff: DemoStaff, locale: Locale): Promise<CenterOverview> {
    const groups = await Promise.all(DEMO_GROUPS.map((g) => this.view(g, locale)));
    const active = groups.filter((g) => g.status === 'active');
    return {
      viewer: toStaff(staff),
      organization: ORGANIZATION,
      totals: {
        enrollments: active.reduce((n, g) => n + g.students, 0),
        activeGroups: active.length,
        upcomingGroups: groups.filter((g) => g.status === 'upcoming').length,
        archivedGroups: groups.filter((g) => g.status === 'archived').length,
        activeTeachers: STAFF_DIRECTORY.filter((s) => s.role === 'TEACHER' && s.status === 'active').length,
        pendingInvitations: STAFF_DIRECTORY.filter((s) => s.status === 'pending').length,
      },
      groups,
    };
  }

  async group(code: string, locale: Locale): Promise<CenterGroupDetail> {
    const group = findGroup(code);
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: `Group ${code} not found` });
    if (!group.roster?.length || !group.diagnosticQuiz) return { group: toCenterGroup(group, null), participation: null };
    const full = await this.teaching.analyse(group, locale);
    return {
      group: toCenterGroup(group, aggregate(full)),
      // Participation only: took the diagnostic yes/no. No scores, no retest or practice membership.
      participation: full.students.map((s) => ({ name: s.name, tookDiagnostic: s.submitted })),
    };
  }

  staff(): CenterStaff {
    return { items: STAFF_DIRECTORY.map((s) => ({ ...s })) };
  }

  settings(): CenterSettings {
    return { organization: ORGANIZATION, permissions: { ...PERMISSION_DEFAULTS }, editable: false };
  }

  private async view(group: DemoGroup, locale: Locale) {
    if (!group.roster?.length || !group.diagnosticQuiz) return toCenterGroup(group, null);
    return toCenterGroup(group, aggregate(await this.teaching.analyse(group, locale)));
  }
}
