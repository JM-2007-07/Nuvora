import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateGroupRequest, Locale, StudyGroupDetail, StudyGroupView } from '@nuvora/shared';
import { randomInt } from 'node:crypto';
import { localizeFields } from '../common/i18n/locale.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { percent } from '../quizzes/scoring.js';
import type { DemoStaff } from '../staff/demo-org.js';

/** The subject new groups study (the Faroz demo subject). */
const DEFAULT_SUBJECT = 'javascript';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

export function newJoinCode(prefix = 'JS'): string {
  let tail = '';
  for (let i = 0; i < 4; i++) tail += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${prefix}-${tail}`;
}

const groupSelect = {
  id: true,
  name: true,
  joinCode: true,
  subjectSlug: true,
  capacity: true,
  schedule: true,
  createdAt: true,
  organizationId: true,
  teacherAccountId: true,
  teacher: { select: { name: true } },
  members: { select: { userId: true, joinedAt: true, user: { select: { displayName: true } } } },
} as const;

type GroupRow = {
  id: string;
  name: string;
  joinCode: string;
  subjectSlug: string;
  capacity: number;
  schedule: string | null;
  createdAt: Date;
  organizationId: string;
  teacherAccountId: string | null;
  teacher: { name: string } | null;
  members: { userId: string; joinedAt: Date; user: { displayName: string } }[];
};

/**
 * Groups created by teacher and center accounts; learners join with a code.
 * Teachers see their groups member by member; centers get group totals only.
 */
@Injectable()
export class GroupsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ---------- teacher ----------

  async teacherGroups(staff: DemoStaff, locale: Locale): Promise<StudyGroupView[]> {
    if (!staff.accountId) return []; // demo staff have code-defined groups only
    const rows = await this.prisma.studyGroup.findMany({ where: { teacherAccountId: staff.accountId }, orderBy: { createdAt: 'desc' }, select: groupSelect });
    return this.views(rows, locale);
  }

  async createForTeacher(staff: DemoStaff, request: CreateGroupRequest, locale: Locale): Promise<StudyGroupView> {
    if (!staff.accountId || !staff.organizationId) throw new ForbiddenException({ code: 'ACCOUNT_REQUIRED', message: 'Create an account to make your own groups' });
    const row = await this.create(staff.organizationId, staff.accountId, request);
    return (await this.views([row], locale))[0];
  }

  async teacherGroupDetail(staff: DemoStaff, id: string, locale: Locale): Promise<StudyGroupDetail> {
    const row = await this.prisma.studyGroup.findUnique({ where: { id }, select: groupSelect });
    if (!row || !staff.accountId || row.teacherAccountId !== staff.accountId) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: 'Group not found' });
    const [view] = await this.views([row], locale);
    const diagnostics = await this.firstDiagnostics(row.members.map((m) => m.userId), row.subjectSlug);
    return {
      group: view,
      members: row.members.map((m) => {
        const d = diagnostics.get(m.userId);
        return { name: m.user.displayName, joinedAt: m.joinedAt.toISOString(), diagnostic: d ? { correct: d.correct, total: d.total, percent: percent(d.correct, d.total), attemptId: d.attemptId } : null };
      }),
    };
  }

  // ---------- center (totals only) ----------

  async centerGroups(staff: DemoStaff, locale: Locale): Promise<StudyGroupView[]> {
    if (!staff.organizationId) return [];
    const rows = await this.prisma.studyGroup.findMany({ where: { organizationId: staff.organizationId }, orderBy: { createdAt: 'desc' }, select: groupSelect });
    return this.views(rows, locale);
  }

  async createForCenter(staff: DemoStaff, request: CreateGroupRequest, locale: Locale): Promise<StudyGroupView> {
    if (!staff.organizationId) throw new ForbiddenException({ code: 'ACCOUNT_REQUIRED', message: 'Create a center account to make groups' });
    const row = await this.create(staff.organizationId, null, request);
    return (await this.views([row], locale))[0];
  }

  // ---------- learner ----------

  async join(learner: LearnerRecord, code: string): Promise<void> {
    const group = await this.prisma.studyGroup.findUnique({ where: { joinCode: code }, select: { id: true, capacity: true, _count: { select: { members: true } } } });
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: 'No group with this code' });
    const already = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: learner.id } } });
    if (already) return;
    if (group._count.members >= group.capacity) throw new ConflictException({ code: 'GROUP_FULL', message: 'This group is full' });
    await this.prisma.groupMember.create({ data: { groupId: group.id, userId: learner.id } });
  }

  async myGroups(learner: LearnerRecord) {
    const rows = await this.prisma.groupMember.findMany({
      where: { userId: learner.id },
      orderBy: { joinedAt: 'desc' },
      select: { joinedAt: true, group: { select: { id: true, name: true, teacher: { select: { name: true } }, organization: { select: { name: true } } } } },
    });
    return rows.map((r) => ({ id: r.group.id, name: r.group.name, teacher: r.group.teacher?.name ?? null, organization: r.group.organization.name, joinedAt: r.joinedAt.toISOString() }));
  }

  // ---------- helpers ----------

  private async create(organizationId: string, teacherAccountId: string | null, request: CreateGroupRequest): Promise<GroupRow> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const joinCode = newJoinCode();
      const taken = await this.prisma.studyGroup.findUnique({ where: { joinCode }, select: { id: true } });
      if (taken) continue;
      return this.prisma.studyGroup.create({
        data: { joinCode, name: request.name, capacity: request.capacity, schedule: request.schedule || null, subjectSlug: DEFAULT_SUBJECT, organizationId, teacherAccountId },
        select: groupSelect,
      });
    }
    throw new ConflictException({ code: 'CODE_COLLISION', message: 'Could not create a unique join code, try again' });
  }

  /** First attempt per user at the subject's CHECKPOINT (diagnostic) quiz, from stored attempts. */
  private async firstDiagnostics(userIds: string[], subjectSlug: string) {
    const attempts = userIds.length
      ? await this.prisma.quizAttempt.findMany({
          where: { userId: { in: userIds }, quiz: { kind: 'CHECKPOINT', subject: { slug: subjectSlug } } },
          orderBy: { submittedAt: 'asc' },
          select: { id: true, userId: true, correctCount: true, totalCount: true },
        })
      : [];
    const first = new Map<string, { attemptId: string; correct: number; total: number }>();
    for (const a of attempts) if (!first.has(a.userId)) first.set(a.userId, { attemptId: a.id, correct: a.correctCount, total: a.totalCount });
    return first;
  }

  private async views(rows: GroupRow[], locale: Locale): Promise<StudyGroupView[]> {
    const subjects = new Map(
      (await this.prisma.subject.findMany({ where: { slug: { in: [...new Set(rows.map((r) => r.subjectSlug))] } }, select: { slug: true, title: true } })).map((s) => [s.slug, s]),
    );
    return Promise.all(
      rows.map(async (r) => {
        const diagnostics = await this.firstDiagnostics(r.members.map((m) => m.userId), r.subjectSlug);
        const scores = [...diagnostics.values()];
        const total = scores.reduce((n, s) => n + s.total, 0);
        const subject = subjects.get(r.subjectSlug);
        return {
          id: r.id,
          name: r.name,
          joinCode: r.joinCode,
          subject: subject ? { slug: subject.slug, ...localizeFields(locale, { title: subject.title }) } : { slug: r.subjectSlug, title: r.subjectSlug, fallbackFields: [] },
          capacity: r.capacity,
          schedule: r.schedule,
          teacher: r.teacher?.name ?? null,
          memberCount: r.members.length,
          submitted: scores.length,
          diagnosticPercent: total ? percent(scores.reduce((n, s) => n + s.correct, 0), total) : null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    );
  }
}
