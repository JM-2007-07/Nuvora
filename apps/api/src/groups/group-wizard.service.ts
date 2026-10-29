import { ConflictException, ForbiddenException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { CreateCenterGroupRequestSchema, GroupWizardOptions, Locale, StudyGroupView } from '@nuvora/shared';
import type { z } from 'zod';
import { isUniqueViolation } from '../accounts/accounts.service.js';
import { localizeFields } from '../common/i18n/locale.js';
import { orgKeyOf } from '../invitations/invitation-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  centerOrganizationId,
  DEMO_CENTER_ORG_ID,
  DEMO_GROUPS,
  DEMO_STAFF,
  DEMO_UNASSIGNED_STUDENTS,
  type DemoStaff,
  STAFF_DIRECTORY,
} from '../staff/demo-org.js';
import { GroupsService, newJoinCode } from './groups.service.js';

type CreateRequest = z.output<typeof CreateCenterGroupRequestSchema>;
type Teacher = GroupWizardOptions['teachers'][number] & { accountId: string | null };

/**
 * Center group wizard (handoff CGroupCreate). Everything is scoped to the staff member's
 * own center: its teachers (demo staff or accounts that accepted this center's invitation),
 * its unassigned students, and codes unique within it.
 */
@Injectable()
export class GroupWizardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupsService) private readonly groups: GroupsService,
  ) {}

  async options(staff: DemoStaff, locale: Locale): Promise<GroupWizardOptions> {
    const organizationId = this.center(staff);
    const subjects = await this.prisma.subject.findMany({ orderBy: { order: 'asc' }, select: { slug: true, title: true } });
    const teachers = await this.teachers(staff, organizationId);
    return {
      subjects: subjects.map((s) => ({ slug: s.slug, title: localizeFields(locale, { title: s.title }).title })),
      teachers: teachers.map((t) => ({ key: t.key, name: t.name, subject: t.subject, available: t.available, synthetic: t.synthetic })),
      students: await this.unassigned(organizationId),
      takenCodes: await this.takenCodes(organizationId),
    };
  }

  async create(staff: DemoStaff, request: CreateRequest, locale: Locale): Promise<StudyGroupView> {
    const organizationId = this.center(staff);
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new ConflictException({ code: 'CENTER_NOT_READY', message: 'The demo center is not set up. Run pnpm db:seed:demo.' });

    const subject = await this.prisma.subject.findUnique({ where: { slug: request.subjectSlug }, select: { slug: true, title: true } });
    if (!subject) throw new UnprocessableEntityException({ code: 'SUBJECT_NOT_FOUND', message: 'Unknown subject', details: [{ path: 'subjectSlug', code: 'SUBJECT_NOT_FOUND' }] });

    if ((await this.takenCodes(organizationId)).includes(request.code)) throw codeTaken();

    let teacher: Teacher | null = null;
    if (request.teacherKey) {
      teacher = (await this.teachers(staff, organizationId)).find((t) => t.key === request.teacherKey && t.available) ?? null;
      if (!teacher) throw new UnprocessableEntityException({ code: 'TEACHER_NOT_IN_CENTER', message: 'This teacher is not on your staff', details: [{ path: 'teacherKey', code: 'TEACHER_NOT_IN_CENTER' }] });
    }

    const free = new Set((await this.unassigned(organizationId)).map((s) => s.id));
    if (request.studentIds.some((id) => !free.has(id))) {
      throw new UnprocessableEntityException({ code: 'STUDENT_NOT_AVAILABLE', message: 'A selected student is already in a group or not in this center', details: [{ path: 'studentIds', code: 'STUDENT_NOT_AVAILABLE' }] });
    }

    const name = localizeFields(locale, { title: subject.title }).title;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const id = await this.prisma.$transaction(async (tx) => {
          const group = await tx.studyGroup.create({
            data: {
              joinCode: newJoinCode(),
              displayCode: request.code,
              name,
              subjectSlug: subject.slug,
              capacity: request.capacity,
              schedule: request.schedule,
              startsOn: new Date(`${request.startsOn}T00:00:00Z`),
              languages: request.languages,
              organizationId,
              teacherKey: teacher?.key ?? null,
              teacherName: teacher?.name ?? null,
              teacherAccountId: teacher?.accountId ?? null,
            },
            select: { id: true },
          });
          if (request.studentIds.length) await tx.groupMember.createMany({ data: request.studentIds.map((userId) => ({ groupId: group.id, userId })) });
          return group.id;
        });
        const created = (await this.groups.centerGroups(staff, locale)).find((g) => g.id === id);
        if (!created) throw new Error('Created group not found');
        return created;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // displayCode taken meanwhile → 409; a joinCode collision → try again with a new one.
        if ((await this.takenCodes(organizationId)).includes(request.code)) throw codeTaken();
      }
    }
    throw new ConflictException({ code: 'CODE_COLLISION', message: 'Could not create a unique join code, try again' });
  }

  // ---------- helpers ----------

  private center(staff: DemoStaff): string {
    const organizationId = centerOrganizationId(staff);
    if (!organizationId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only center staff can create center groups' });
    return organizationId;
  }

  private async teachers(staff: DemoStaff, organizationId: string): Promise<Teacher[]> {
    const list: Teacher[] = [];
    if (organizationId === DEMO_CENTER_ORG_ID) {
      for (const s of DEMO_STAFF.filter((d) => d.role === 'TEACHER')) list.push({ key: s.slug, name: s.name, subject: s.title, available: true, synthetic: false, accountId: null });
      for (const d of STAFF_DIRECTORY.filter((d) => d.role === 'TEACHER' && d.status === 'active' && d.synthetic)) {
        list.push({ key: `ref:${d.name}`, name: d.name, subject: d.subject, available: false, synthetic: true, accountId: null });
      }
    }
    const orgKey = orgKeyOf(staff);
    if (orgKey) {
      const accepted = await this.prisma.staffInvitation.findMany({
        where: { orgKey, acceptedAccountId: { not: null }, revokedAt: null },
        orderBy: { acceptedAt: 'asc' },
        select: { subject: true, acceptedAccount: { select: { id: true, name: true } } },
      });
      for (const a of accepted) {
        if (a.acceptedAccount && !list.some((t) => t.key === `acct:${a.acceptedAccount!.id}`)) {
          list.push({ key: `acct:${a.acceptedAccount.id}`, name: a.acceptedAccount.name, subject: a.subject, available: true, synthetic: false, accountId: a.acceptedAccount.id });
        }
      }
    }
    return list;
  }

  /** Demo center: the design's unassigned students who are not in one of its groups yet. Account centers: none (learners join by code). */
  private async unassigned(organizationId: string): Promise<GroupWizardOptions['students']> {
    if (organizationId !== DEMO_CENTER_ORG_ID) return [];
    const users = await this.prisma.user.findMany({
      where: { kind: 'DEMO', demoSlug: { in: DEMO_UNASSIGNED_STUDENTS.map((s) => s.slug) }, memberships: { none: { group: { organizationId } } } },
      select: { id: true, demoSlug: true, displayName: true },
    });
    return DEMO_UNASSIGNED_STUDENTS.flatMap((s) => {
      const user = users.find((u) => u.demoSlug === s.slug);
      return user ? [{ id: user.id, name: user.displayName, joinedOn: s.joinedOn, wants: s.wants }] : [];
    });
  }

  private async takenCodes(organizationId: string): Promise<string[]> {
    const stored = await this.prisma.studyGroup.findMany({ where: { organizationId, displayCode: { not: null } }, select: { displayCode: true } });
    const demo = organizationId === DEMO_CENTER_ORG_ID ? DEMO_GROUPS.map((g) => g.code) : [];
    return [...new Set([...demo, ...stored.map((g) => g.displayCode!)])].sort();
  }
}

const codeTaken = () => new ConflictException({ code: 'CODE_TAKEN', message: 'This group code is already used in your center', details: [{ path: 'code', code: 'CODE_TAKEN' }] });
