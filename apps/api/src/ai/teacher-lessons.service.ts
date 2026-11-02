import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LearnerTeacherLesson, Locale, TeacherLesson, TeacherLessonDraft } from '@nuvora/shared';
import { AssessmentsService } from '../assessments/assessments.service.js';
import { ExamService } from '../exam/exam.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { groupLearnerSubjects } from '../notifications/recipients.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DemoStaff } from '../staff/demo-org.js';

type Row = Prisma.TeacherLessonGetPayload<object>;

const toView = (r: Row): TeacherLesson => ({
  id: r.id,
  groupCode: r.groupCode,
  title: r.title,
  body: r.body,
  language: r.language,
  aiGenerated: r.aiGenerated,
  publishedAt: r.publishedAt?.toISOString() ?? null,
  updatedAt: r.updatedAt.toISOString(),
});

const notFound = () => new NotFoundException({ code: 'LESSON_NOT_FOUND', message: 'No such lesson' });

/** Lessons a teacher gives one group. Scoped to the owner (someone else's id → 404); learners see only published lessons of their groups. */
@Injectable()
export class TeacherLessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssessmentsService) private readonly assessments: AssessmentsService,
    @Inject(ExamService) private readonly exam: ExamService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async list(staff: DemoStaff): Promise<{ items: TeacherLesson[] }> {
    const rows = await this.prisma.teacherLesson.findMany({ where: { ownerKey: staff.slug }, orderBy: { updatedAt: 'desc' } });
    return { items: rows.map(toView) };
  }

  private async own(staff: DemoStaff, id: string): Promise<Row> {
    const row = await this.prisma.teacherLesson.findFirst({ where: { id, ownerKey: staff.slug } });
    if (!row) throw notFound();
    return row;
  }

  async get(staff: DemoStaff, id: string): Promise<TeacherLesson> {
    return toView(await this.own(staff, id));
  }

  async create(staff: DemoStaff, draft: TeacherLessonDraft, locale: Locale, aiGenerated = false): Promise<TeacherLesson> {
    await this.assessments.ownGroup(staff, draft.groupCode, locale);
    return toView(await this.prisma.teacherLesson.create({ data: { ...draft, ownerKey: staff.slug, aiGenerated } }));
  }

  async update(staff: DemoStaff, id: string, draft: TeacherLessonDraft, locale: Locale): Promise<TeacherLesson> {
    await this.own(staff, id);
    await this.assessments.ownGroup(staff, draft.groupCode, locale);
    return toView(await this.prisma.teacherLesson.update({ where: { id }, data: draft }));
  }

  async remove(staff: DemoStaff, id: string): Promise<void> {
    await this.own(staff, id);
    await this.prisma.teacherLesson.delete({ where: { id } });
  }

  async setPublished(staff: DemoStaff, id: string, published: boolean): Promise<TeacherLesson> {
    const row = await this.own(staff, id);
    const updated = await this.prisma.teacherLesson.update({ where: { id }, data: { publishedAt: published ? (row.publishedAt ?? new Date()) : null } });
    if (published && !row.publishedAt) {
      const subjects = await groupLearnerSubjects(this.prisma, row.groupCode);
      await Promise.all(subjects.map((subject) => this.notifications.notify({ subject, category: 'learning_task', dedupeKey: `teacher-lesson:${id}`, params: { title: row.title }, path: '/learn' })));
    }
    return toView(updated);
  }

  // ---------- learners ----------

  private toLearnerView(r: Row): LearnerTeacherLesson {
    return { id: r.id, title: r.title, body: r.body, language: r.language, aiGenerated: r.aiGenerated, publishedAt: r.publishedAt!.toISOString() };
  }

  async listForLearner(learner: LearnerRecord): Promise<{ items: LearnerTeacherLesson[] }> {
    const codes = await this.exam.groupCodesOf(learner);
    if (!codes.length) return { items: [] };
    const rows = await this.prisma.teacherLesson.findMany({ where: { groupCode: { in: codes }, publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' } });
    return { items: rows.map((r) => this.toLearnerView(r)) };
  }

  async forLearner(learner: LearnerRecord, id: string): Promise<LearnerTeacherLesson> {
    const codes = await this.exam.groupCodesOf(learner);
    const row = await this.prisma.teacherLesson.findFirst({ where: { id, groupCode: { in: codes }, publishedAt: { not: null } } });
    if (!row) throw notFound();
    return this.toLearnerView(row);
  }
}
