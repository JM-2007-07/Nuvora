import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CenterGroup, CenterGroupDetail, CenterOverview, CenterSettings, CenterStaff, GroupAnalytics, Locale } from '@nuvora/shared';
import { GroupsService } from '../groups/groups.service.js';
import { orgKeyOf } from '../invitations/invitation-rules.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { PermissionsService } from '../invitations/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEMO_GROUPS, type DemoStaff, findGroup, STAFF_DIRECTORY } from '../staff/demo-org.js';
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
  constructor(
    @Inject(TeachingService) private readonly teaching: TeachingService,
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InvitationsService) private readonly invitations: InvitationsService,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
  ) {}

  async overview(staff: DemoStaff, locale: Locale): Promise<CenterOverview> {
    if (staff.accountId) return this.accountOverview(staff, locale);
    const groups = await this.views(locale);
    const stored = await this.invitations.list(staff);
    const active = groups.filter((g) => g.status === 'active');
    return {
      viewer: toStaff(staff),
      organization: ORGANIZATION,
      totals: {
        enrollments: active.reduce((n, g) => n + g.students, 0),
        activeGroups: active.length,
        upcomingGroups: groups.filter((g) => g.status === 'upcoming').length,
        archivedGroups: groups.filter((g) => g.status === 'archived').length,
        activeTeachers: STAFF_DIRECTORY.filter((s) => s.role === 'TEACHER' && s.status === 'active').length + stored.filter((i) => i.status === 'accepted').length,
        pendingInvitations: STAFF_DIRECTORY.filter((s) => s.status === 'pending').length + stored.filter((i) => i.status === 'pending').length,
      },
      groups,
    };
  }

  async group(code: string, locale: Locale): Promise<CenterGroupDetail> {
    const group = findGroup(code);
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: `Group ${code} not found` });
    if (!group.roster?.length || !group.diagnosticQuiz) {
      const view = (await this.views(locale)).find((g) => g.code === group.code)!;
      return { group: view, participation: null };
    }
    const full = await this.teaching.analyse(group, locale);
    return {
      group: toCenterGroup(group, aggregate(full)),
      // Participation only: took the diagnostic yes/no. No scores, no retest or practice membership.
      participation: full.students.map((s) => ({ name: s.name, tookDiagnostic: s.submitted })),
    };
  }

  async staff(staff: DemoStaff): Promise<CenterStaff> {
    const invitations = await this.invitations.list(staff);
    const canInvite = staff.role === 'ADMIN' && orgKeyOf(staff) !== null;
    if (!staff.organizationId) return { items: STAFF_DIRECTORY.map((s) => ({ ...s })), invitations, canInvite };
    const accounts = await this.prisma.account.findMany({ where: { organizationId: staff.organizationId }, orderBy: { createdAt: 'asc' }, select: { name: true, role: true } });
    return {
      items: accounts.map((a) => ({
        name: a.name,
        role: a.role === 'CENTER_ADMIN' ? ('ADMIN' as const) : ('TEACHER' as const),
        subject: '',
        status: 'active' as const,
        activity: { kind: 'NONE' as const, date: null, until: null },
        synthetic: false,
      })),
      invitations,
      canInvite,
    };
  }

  /** A center admin account: its own organization and groups from the database (totals only). */
  private async accountOverview(staff: DemoStaff, locale: Locale): Promise<CenterOverview> {
    const own = await this.groups.centerGroups(staff, locale);
    const groups = own.map((g): CenterGroup => {
      const participationPercent = g.memberCount ? Math.round((g.submitted / g.memberCount) * 100) : null;
      const flags: CenterGroup['flags'] = [];
      if (g.memberCount === 0) flags.push('SETUP_INCOMPLETE');
      else if (participationPercent !== null && participationPercent < 95) flags.push('PARTICIPATION_UNDER_95');
      return {
        code: g.joinCode,
        name: g.name,
        teacher: g.teacher ?? '—',
        status: 'active',
        schedule: g.schedule ?? '',
        capacity: g.capacity,
        students: g.memberCount,
        submitted: g.submitted,
        participationPercent,
        diagnosticPercent: g.diagnosticPercent,
        topics: null,
        flags,
        recorded: true,
        synthetic: false,
      };
    });
    const teachers = staff.organizationId ? await this.prisma.account.count({ where: { organizationId: staff.organizationId, role: 'TEACHER' } }) : 0;
    return {
      viewer: toStaff(staff),
      organization: staff.title || ORGANIZATION,
      totals: { enrollments: groups.reduce((n, g) => n + g.students, 0), activeGroups: groups.length, upcomingGroups: 0, archivedGroups: 0, activeTeachers: teachers, pendingInvitations: (await this.invitations.list(staff)).filter((i) => i.status === 'pending').length },
      groups,
    };
  }

  async settings(staff: DemoStaff): Promise<CenterSettings> {
    const orgKey = orgKeyOf(staff);
    const { permissions, updatedAt } = await this.permissions.get(orgKey);
    return { organization: staff.accountId ? staff.title : ORGANIZATION, permissions, editable: staff.role === 'ADMIN' && orgKey !== null, updatedAt: updatedAt?.toISOString() ?? null };
  }

  /** Recorded groups first; their localized topic titles also name the reference figures of the others. */
  private async views(locale: Locale): Promise<CenterGroup[]> {
    const recorded = new Map<string, GroupAggregate>();
    for (const g of DEMO_GROUPS) if (g.roster?.length && g.diagnosticQuiz) recorded.set(g.code, aggregate(await this.teaching.analyse(g, locale)));
    const titles = [...recorded.values()][0]?.topics.map((t) => t.title);
    return DEMO_GROUPS.map((g) => toCenterGroup(g, recorded.get(g.code) ?? null, titles));
  }
}
