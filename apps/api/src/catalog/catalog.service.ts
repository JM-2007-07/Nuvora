import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LibraryItem, Locale, SubjectDetail, SubjectListResponse, TopicDetail } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Query shapes (exported so tests can type their fixture rows against them). */
export const subjectListSelect = {
  slug: true,
  title: true,
  description: true,
  _count: { select: { topics: true } },
} satisfies Prisma.SubjectSelect;

const byOrder = [{ order: 'asc' }, { slug: 'asc' }] as const;

export const subjectDetailSelect = {
  slug: true,
  title: true,
  description: true,
  isPublished: true,
  topics: {
    orderBy: [...byOrder],
    select: {
      slug: true,
      order: true,
      title: true,
      summary: true,
      prerequisites: { orderBy: { prerequisite: { order: 'asc' } }, select: { prerequisite: { select: { slug: true } } } },
    },
  },
} satisfies Prisma.SubjectSelect;

export const topicDetailSelect = {
  slug: true,
  title: true,
  summary: true,
  subject: { select: { slug: true, title: true, isPublished: true } },
  prerequisites: { orderBy: { prerequisite: { order: 'asc' } }, select: { prerequisite: { select: { slug: true, title: true } } } },
  lessons: { orderBy: [...byOrder], select: { slug: true, title: true, estimatedMinutes: true } },
  resources: {
    orderBy: [{ order: 'asc' }, { key: 'asc' }],
    select: { key: true, type: true, title: true, author: true, url: true, languages: true, whyUseful: true },
  },
  quizzes: {
    where: { kind: 'TOPIC' },
    orderBy: { slug: 'asc' },
    take: 1,
    select: { slug: true, title: true, _count: { select: { questions: true } } },
  },
} satisfies Prisma.TopicSelect;

export type SubjectListRow = Prisma.SubjectGetPayload<{ select: typeof subjectListSelect }>;
export type SubjectDetailRow = Prisma.SubjectGetPayload<{ select: typeof subjectDetailSelect }>;
export type TopicDetailRow = Prisma.TopicGetPayload<{ select: typeof topicDetailSelect }>;

/** Subjects and topics (FR-CAT-01..03, FR-RES-01). Read-only; unpublished subjects are hidden. */
@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSubjects(locale: Locale): Promise<SubjectListResponse> {
    const rows = await this.prisma.subject.findMany({ where: { isPublished: true }, orderBy: [...byOrder], select: subjectListSelect });
    return {
      items: rows.map((row) => ({
        slug: row.slug,
        ...localizeFields(locale, { title: row.title, description: row.description }),
        topicCount: row._count.topics,
      })),
    };
  }

  async getSubject(slug: string, locale: Locale): Promise<SubjectDetail> {
    const row = await this.prisma.subject.findUnique({ where: { slug }, select: subjectDetailSelect });
    if (!row || !row.isPublished) throw new NotFoundException({ code: 'SUBJECT_NOT_FOUND', message: `Subject "${slug}" not found` });
    return {
      slug: row.slug,
      ...localizeFields(locale, { title: row.title, description: row.description }),
      topics: row.topics.map((topic) => ({
        slug: topic.slug,
        order: topic.order,
        ...localizeFields(locale, { title: topic.title, summary: topic.summary }),
        prerequisites: topic.prerequisites.map((p) => p.prerequisite.slug),
      })),
    };
  }

  /** Library: every resource of the published subjects, in subject and topic order. */
  async library(locale: Locale): Promise<LibraryItem[]> {
    const rows = await this.prisma.resource.findMany({
      where: { topic: { subject: { isPublished: true } } },
      orderBy: [{ topic: { subject: { order: 'asc' } } }, { topic: { order: 'asc' } }, { order: 'asc' }],
      select: {
        key: true, type: true, title: true, author: true, url: true, languages: true, whyUseful: true,
        topic: { select: { slug: true, title: true, subject: { select: { slug: true, title: true } } } },
      },
    });
    return rows.map((r) => ({
      resource: { key: r.key, type: r.type, author: r.author, url: r.url, languages: r.languages, ...localizeFields(locale, { title: r.title, whyUseful: r.whyUseful }) },
      topic: { slug: r.topic.slug, ...localizeFields(locale, { title: r.topic.title }) },
      subject: { slug: r.topic.subject.slug, ...localizeFields(locale, { title: r.topic.subject.title }) },
    }));
  }

  async getTopic(slug: string, locale: Locale): Promise<TopicDetail> {
    const row = await this.prisma.topic.findUnique({ where: { slug }, select: topicDetailSelect });
    if (!row || !row.subject.isPublished) throw new NotFoundException({ code: 'TOPIC_NOT_FOUND', message: `Topic "${slug}" not found` });
    const quiz = row.quizzes[0];
    return {
      slug: row.slug,
      ...localizeFields(locale, { title: row.title, summary: row.summary }),
      subject: { slug: row.subject.slug, ...localizeFields(locale, { title: row.subject.title }) },
      prerequisites: row.prerequisites.map(({ prerequisite }) => ({
        slug: prerequisite.slug,
        ...localizeFields(locale, { title: prerequisite.title }),
      })),
      lessons: row.lessons.map((lesson) => ({
        slug: lesson.slug,
        ...localizeFields(locale, { title: lesson.title }),
        estimatedMinutes: lesson.estimatedMinutes,
      })),
      resources: row.resources.map((resource) => ({
        key: resource.key,
        type: resource.type,
        author: resource.author,
        url: resource.url,
        languages: resource.languages,
        ...localizeFields(locale, { title: resource.title, whyUseful: resource.whyUseful }),
      })),
      quiz: quiz ? { slug: quiz.slug, ...localizeFields(locale, { title: quiz.title }), questionCount: quiz._count.questions } : null,
    };
  }
}
