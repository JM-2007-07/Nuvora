import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LessonDetail, Locale } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const lessonDetailSelect = {
  slug: true,
  title: true,
  body: true,
  estimatedMinutes: true,
  topic: { select: { slug: true, title: true, subject: { select: { isPublished: true } } } },
} satisfies Prisma.LessonSelect;

export type LessonDetailRow = Prisma.LessonGetPayload<{ select: typeof lessonDetailSelect }>;

/** Lesson content (FR-LES-01). Read-only. */
@Injectable()
export class LessonsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getLesson(slug: string, locale: Locale): Promise<LessonDetail> {
    const row = await this.prisma.lesson.findUnique({ where: { slug }, select: lessonDetailSelect });
    if (!row || !row.topic.subject.isPublished) throw new NotFoundException({ code: 'LESSON_NOT_FOUND', message: `Lesson "${slug}" not found` });
    return {
      slug: row.slug,
      ...localizeFields(locale, { title: row.title, body: row.body }),
      estimatedMinutes: row.estimatedMinutes,
      topic: { slug: row.topic.slug, ...localizeFields(locale, { title: row.topic.title }) },
    };
  }
}
