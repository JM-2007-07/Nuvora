import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Locale, PublicQuiz } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Pre-submission quiz query. It deliberately does NOT select `isCorrect` or
 * `explanation` (FR-QUIZ-06); a unit test guards this select object.
 */
export const publicQuizSelect = {
  slug: true,
  title: true,
  kind: true,
  subject: { select: { isPublished: true } },
  topic: { select: { slug: true, title: true } },
  questions: {
    orderBy: [{ order: 'asc' }, { key: 'asc' }],
    select: {
      key: true,
      type: true,
      prompt: true,
      options: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { key: true, text: true } },
    },
  },
} satisfies Prisma.QuizSelect;

export type PublicQuizRow = Prisma.QuizGetPayload<{ select: typeof publicQuizSelect }>;

/** Quiz delivery before submission (FR-QUIZ-01, FR-QUIZ-06). Read-only. */
@Injectable()
export class QuizzesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPublicQuiz(slug: string, locale: Locale): Promise<PublicQuiz> {
    const row = await this.prisma.quiz.findUnique({ where: { slug }, select: publicQuizSelect });
    if (!row || !row.subject.isPublished) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND', message: `Quiz "${slug}" not found` });
    // Built field by field: only key/type/prompt/text ever leave the server.
    return {
      slug: row.slug,
      ...localizeFields(locale, { title: row.title }),
      kind: row.kind,
      topic: row.topic ? { slug: row.topic.slug, ...localizeFields(locale, { title: row.topic.title }) } : null,
      questions: row.questions.map((question) => ({
        key: question.key,
        type: question.type,
        ...localizeFields(locale, { prompt: question.prompt }),
        options: question.options.map((option) => ({ key: option.key, ...localizeFields(locale, { text: option.text }) })),
      })),
    };
  }
}
