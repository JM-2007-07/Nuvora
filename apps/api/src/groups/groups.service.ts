import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateGroupRequest,
  Locale,
  StudyGroupDetail,
  StudyGroupView,
} from '@nuvora/shared';
import { randomInt } from 'node:crypto';
import { localizeFields } from '../common/i18n/locale.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { percent } from '../quizzes/scoring.js';
import { centerSafeTotals } from '../center/center-view.js';
import { isUniqueViolation } from '../accounts/accounts.service.js';
import { centerOrganizationId, type DemoStaff } from '../staff/demo-org.js';

/** The subject new groups study (the Faroz demo subject). */
const DEFAULT_SUBJECT = 'javascript';
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

export function newJoinCode(prefix = 'JS'): string {
  let tail = '';
  for (let i = 0; i < 4; i++)
    tail += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
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
  displayCode: true,
  startsOn: true,
  languages: true,
  teacherKey: true,
  teacherName: true,
  members: {
    select: {
      userId: true,
      joinedAt: true,
      user: { select: { displayName: true } },
    },
  },
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
  displayCode: string | null;
  startsOn: Date | null;
  languages: ('tg' | 'ru' | 'en')[];
  teacherKey: string | null;
  teacherName: string | null;
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

  async teacherGroups(
    staff: DemoStaff,
    locale: Locale,
  ): Promise<StudyGroupView[]> {
    // Own groups (accounts) and groups a center assigned with the wizard (demo staff and accounts, by key).
    const rows = await this.prisma.studyGroup.findMany({
      where: { OR: [{ teacherKey: staff.slug }, ...(staff.accountId ? [{ teacherAccountId: staff.accountId }] : [])] },
      orderBy: { createdAt: 'desc' },
      select: groupSelect,
    });
    return this.views(rows, locale);
  }

  async createForTeacher(
    staff: DemoStaff,
    request: CreateGroupRequest,
    locale: Locale,
  ): Promise<StudyGroupView> {
    if (!staff.accountId || !staff.organizationId)
      throw new ForbiddenException({
        code: 'ACCOUNT_REQUIRED',
        message: 'Create an account to make your own groups',
      });
    const row = await this.create(
      staff.organizationId,
      staff.accountId,
      request,
    );
    return (await this.views([row], locale))[0];
  }

  async teacherGroupDetail(
    staff: DemoStaff,
    id: string,
    locale: Locale,
  ): Promise<StudyGroupDetail> {
    const row = await this.prisma.studyGroup.findUnique({
      where: { id },
      select: groupSelect,
    });
    const teaches = row && (row.teacherKey === staff.slug || (!!staff.accountId && row.teacherAccountId === staff.accountId));
    if (!row || !teaches)
      throw new NotFoundException({
        code: 'GROUP_NOT_FOUND',
        message: 'Group not found',
      });
    const [view] = await this.views([row], locale);
    const diagnostics = await this.firstDiagnostics(
      row.members.map((m) => m.userId),
      row.subjectSlug,
    );
    return {
      group: view,
      members: row.members.map((m) => {
        const d = diagnostics.get(m.userId);
        return {
          name: m.user.displayName,
          joinedAt: m.joinedAt.toISOString(),
          diagnostic: d
            ? {
                correct: d.correct,
                total: d.total,
                percent: percent(d.correct, d.total),
                attemptId: d.attemptId,
              }
            : null,
        };
      }),
    };
  }

  // ---------- center (totals only) ----------

  async centerGroups(
    staff: DemoStaff,
    locale: Locale,
  ): Promise<StudyGroupView[]> {
    const organizationId = centerOrganizationId(staff);
    if (!organizationId) return [];
    const rows = await this.prisma.studyGroup.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: groupSelect,
    });
    return (await this.views(rows, locale)).map(centerSafeTotals);
  }

  /** A center's database group by its code: the totals view plus who took the diagnostic (yes/no only, never scores). */
  async centerGroupParticipation(
    staff: DemoStaff,
    displayCode: string,
    locale: Locale,
  ): Promise<{ group: StudyGroupView; participation: { name: string; tookDiagnostic: boolean }[] } | null> {
    const organizationId = centerOrganizationId(staff);
    if (!organizationId) return null;
    const row = await this.prisma.studyGroup.findUnique({
      where: { organizationId_displayCode: { organizationId, displayCode } },
      select: groupSelect,
    });
    if (!row) return null;
    const group = centerSafeTotals((await this.views([row], locale))[0]!);
    const diagnostics = await this.firstDiagnostics(
      row.members.map((m) => m.userId),
      row.subjectSlug,
    );
    return {
      group,
      participation: row.members.map((m) => ({
        name: m.user.displayName,
        tookDiagnostic: diagnostics.has(m.userId),
      })),
    };
  }

  async createForCenter(
    staff: DemoStaff,
    request: CreateGroupRequest,
    locale: Locale,
  ): Promise<StudyGroupView> {
    if (!staff.organizationId)
      throw new ForbiddenException({
        code: 'ACCOUNT_REQUIRED',
        message: 'Create a center account to make groups',
      });
    const row = await this.create(staff.organizationId, null, request);
    return (await this.views([row], locale))[0];
  }

  // ---------- learner ----------

  /** Idempotent. Capacity is checked under a row lock on the group, so two learners can't take the last seat. */
  async join(learner: LearnerRecord, code: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string; capacity: number }[]
      >`SELECT id, capacity FROM study_groups WHERE "joinCode" = ${code} FOR UPDATE`;
      const group = locked[0];
      if (!group)
        throw new NotFoundException({
          code: 'GROUP_NOT_FOUND',
          message: 'No group with this code',
        });
      const already = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: learner.id } },
      });
      if (already) return;
      const members = await tx.groupMember.count({
        where: { groupId: group.id },
      });
      if (members >= group.capacity)
        throw new ConflictException({
          code: 'GROUP_FULL',
          message: 'This group is full',
        });
      await tx.groupMember.create({
        data: { groupId: group.id, userId: learner.id },
      });
    });
  }

  async myGroups(learner: LearnerRecord) {
    const rows = await this.prisma.groupMember.findMany({
      where: { userId: learner.id },
      orderBy: { joinedAt: 'desc' },
      select: {
        joinedAt: true,
        group: {
          select: {
            id: true,
            name: true,
            teacher: { select: { name: true } },
            organization: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.group.id,
      name: r.group.name,
      teacher: r.group.teacher?.name ?? null,
      organization: r.group.organization.name,
      joinedAt: r.joinedAt.toISOString(),
    }));
  }

  // ---------- helpers ----------

  private async create(
    organizationId: string,
    teacherAccountId: string | null,
    request: CreateGroupRequest,
  ): Promise<GroupRow> {
    // The unique index on joinCode decides; on a collision, try a new code.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.studyGroup.create({
          data: {
            joinCode: newJoinCode(),
            name: request.name,
            capacity: request.capacity,
            schedule: request.schedule || null,
            subjectSlug: DEFAULT_SUBJECT,
            organizationId,
            teacherAccountId,
          },
          select: groupSelect,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new ConflictException({
      code: 'CODE_COLLISION',
      message: 'Could not create a unique join code, try again',
    });
  }

  /** First attempt per user at the subject's CHECKPOINT (diagnostic) quiz, from stored attempts. */
  private async firstDiagnostics(userIds: string[], subjectSlug: string) {
    const attempts = userIds.length
      ? await this.prisma.quizAttempt.findMany({
          where: {
            userId: { in: userIds },
            quiz: { kind: 'CHECKPOINT', subject: { slug: subjectSlug } },
          },
          orderBy: { submittedAt: 'asc' },
          select: {
            id: true,
            userId: true,
            correctCount: true,
            totalCount: true,
          },
        })
      : [];
    const first = new Map<
      string,
      { attemptId: string; correct: number; total: number }
    >();
    for (const a of attempts)
      if (!first.has(a.userId))
        first.set(a.userId, {
          attemptId: a.id,
          correct: a.correctCount,
          total: a.totalCount,
        });
    return first;
  }

  private async views(
    rows: GroupRow[],
    locale: Locale,
  ): Promise<StudyGroupView[]> {
    if (!rows.length) return [];
    const subjects = new Map(
      (
        await this.prisma.subject.findMany({
          where: { slug: { in: [...new Set(rows.map((r) => r.subjectSlug))] } },
          select: { slug: true, title: true },
        })
      ).map((s) => [s.slug, s]),
    );
    return Promise.all(
      rows.map(async (r) => {
        const diagnostics = await this.firstDiagnostics(
          r.members.map((m) => m.userId),
          r.subjectSlug,
        );
        const scores = [...diagnostics.values()];
        const total = scores.reduce((n, s) => n + s.total, 0);
        const subject = subjects.get(r.subjectSlug);
        return {
          id: r.id,
          name: r.name,
          joinCode: r.joinCode,
          subject: subject
            ? {
                slug: subject.slug,
                ...localizeFields(locale, { title: subject.title }),
              }
            : { slug: r.subjectSlug, title: r.subjectSlug, fallbackFields: [] },
          capacity: r.capacity,
          schedule: r.schedule,
          teacher: r.teacherName ?? r.teacher?.name ?? null,
          memberCount: r.members.length,
          submitted: scores.length,
          diagnosticPercent: total
            ? percent(
                scores.reduce((n, s) => n + s.correct, 0),
                total,
              )
            : null,
          createdAt: r.createdAt.toISOString(),
          displayCode: r.displayCode,
          startsOn: r.startsOn ? r.startsOn.toISOString().slice(0, 10) : null,
          languages: r.languages,
        };
      }),
    );
  }
}
