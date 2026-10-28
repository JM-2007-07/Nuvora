import type { SubjectDetailRow, SubjectListRow, TopicDetailRow } from '../../src/catalog/catalog.service.js';
import type { LessonDetailRow } from '../../src/lessons/lessons.service.js';
import type { PublicQuizRow } from '../../src/quizzes/quizzes.service.js';
import type { ContentSet } from '../../src/seed/content/index.js';
import { MemorySeedStore } from '../../src/seed/load/memory-seed-store.js';
import { seedContent } from '../../src/seed/load/seed-content.js';
import type { ContentSnapshot } from '../../src/seed/load/types.js';

/**
 * Test double for PrismaService, serving the Content API queries from an
 * in-memory snapshot (no PostgreSQL). Rows are typed with the Prisma payload
 * types of the real `select` objects, so the shapes cannot drift from the queries.
 *
 * `leakAnswers: true` adds isCorrect/explanation to quiz rows, simulating a query
 * that selected too much, to prove the API still never serializes them.
 */
export interface FakeContentOptions {
  unpublished?: string[];
  leakAnswers?: boolean;
}

export async function snapshotOf(content: ContentSet): Promise<ContentSnapshot> {
  const store = new MemorySeedStore();
  const result = await seedContent(store, content);
  if (result.status !== 'applied' && result.status !== 'unchanged') throw new Error(`fixture content did not load: ${result.status}`);
  return store.state;
}

export function fakeContentPrisma(db: ContentSnapshot, options: FakeContentOptions = {}) {
  const published = (subjectId: string) => !options.unpublished?.includes(db.subjects.find((s) => s.id === subjectId)?.slug ?? '');
  const byOrder = <T extends { order: number; slug?: string; key?: string }>(rows: T[]) =>
    [...rows].sort((a, b) => a.order - b.order || String(a.slug ?? a.key).localeCompare(String(b.slug ?? b.key)));
  const topicById = (id: string) => db.topics.find((t) => t.id === id)!;
  const prerequisitesOf = (topicId: string) =>
    byOrder(db.prerequisites.filter((p) => p.topicId === topicId).map((p) => topicById(p.prerequisiteId)));

  const subjectList = (): SubjectListRow[] =>
    byOrder(db.subjects.filter((s) => published(s.id))).map((s) => ({
      slug: s.slug,
      title: s.title as SubjectListRow['title'],
      description: s.description as SubjectListRow['description'],
      _count: { topics: db.topics.filter((t) => t.subjectId === s.id).length },
    }));

  const subjectDetail = (slug: string): SubjectDetailRow | null => {
    const s = db.subjects.find((x) => x.slug === slug);
    if (!s) return null;
    return {
      slug: s.slug,
      title: s.title as SubjectDetailRow['title'],
      description: s.description as SubjectDetailRow['description'],
      isPublished: published(s.id),
      topics: byOrder(db.topics.filter((t) => t.subjectId === s.id)).map((t) => ({
        slug: t.slug,
        order: t.order,
        title: t.title as SubjectDetailRow['title'],
        summary: t.summary as SubjectDetailRow['title'],
        prerequisites: prerequisitesOf(t.id).map((p) => ({ prerequisite: { slug: p.slug } })),
      })),
    };
  };

  const topicDetail = (slug: string): TopicDetailRow | null => {
    const t = db.topics.find((x) => x.slug === slug);
    if (!t) return null;
    const subject = db.subjects.find((s) => s.id === t.subjectId)!;
    const quiz = db.quizzes.filter((q) => q.topicId === t.id && q.kind === 'TOPIC').sort((a, b) => a.slug.localeCompare(b.slug))[0];
    return {
      slug: t.slug,
      title: t.title as TopicDetailRow['title'],
      summary: t.summary as TopicDetailRow['summary'],
      subject: { slug: subject.slug, title: subject.title as TopicDetailRow['title'], isPublished: published(subject.id) },
      prerequisites: prerequisitesOf(t.id).map((p) => ({ prerequisite: { slug: p.slug, title: p.title as TopicDetailRow['title'] } })),
      lessons: byOrder(db.lessons.filter((l) => l.topicId === t.id)).map((l) => ({
        slug: l.slug,
        title: l.title as TopicDetailRow['title'],
        estimatedMinutes: l.estimatedMinutes,
      })),
      resources: byOrder(db.resources.filter((r) => r.topicId === t.id)).map((r) => ({
        key: r.key,
        type: r.type,
        title: r.title as TopicDetailRow['title'],
        author: r.author,
        url: r.url,
        languages: r.languages,
        whyUseful: r.whyUseful as TopicDetailRow['title'],
      })),
      quizzes: quiz
        ? [{ slug: quiz.slug, title: quiz.title as TopicDetailRow['title'], _count: { questions: db.questions.filter((q) => q.quizId === quiz.id).length } }]
        : [],
    };
  };

  const lessonDetail = (slug: string): LessonDetailRow | null => {
    const l = db.lessons.find((x) => x.slug === slug);
    if (!l) return null;
    const t = topicById(l.topicId);
    return {
      slug: l.slug,
      title: l.title as LessonDetailRow['title'],
      body: l.body as LessonDetailRow['body'],
      estimatedMinutes: l.estimatedMinutes,
      topic: { slug: t.slug, title: t.title as LessonDetailRow['title'], subject: { isPublished: published(t.subjectId) } },
    };
  };

  const publicQuiz = (slug: string): PublicQuizRow | null => {
    const q = db.quizzes.find((x) => x.slug === slug);
    if (!q) return null;
    const topic = q.topicId ? topicById(q.topicId) : null;
    return {
      slug: q.slug,
      title: q.title as PublicQuizRow['title'],
      kind: q.kind,
      subject: { isPublished: published(q.subjectId) },
      topic: topic ? { slug: topic.slug, title: topic.title as PublicQuizRow['title'] } : null,
      questions: byOrder(db.questions.filter((x) => x.quizId === q.id)).map((question) => ({
        key: question.key,
        type: question.type,
        prompt: question.prompt as PublicQuizRow['title'],
        ...(options.leakAnswers ? { explanation: question.explanation } : {}),
        options: byOrder(db.options.filter((o) => o.questionId === question.id)).map((o) => ({
          key: o.key,
          text: o.text as PublicQuizRow['title'],
          ...(options.leakAnswers ? { isCorrect: o.isCorrect } : {}),
        })),
      })),
    };
  };

  const slugOf = (args: { where: { slug: string } }) => args.where.slug;
  return {
    subject: {
      findMany: async () => subjectList(),
      findUnique: async (args: { where: { slug: string } }) => subjectDetail(slugOf(args)),
    },
    topic: { findUnique: async (args: { where: { slug: string } }) => topicDetail(slugOf(args)) },
    lesson: { findUnique: async (args: { where: { slug: string } }) => lessonDetail(slugOf(args)) },
    quiz: { findUnique: async (args: { where: { slug: string } }) => publicQuiz(slugOf(args)) },
    $queryRaw: async () => [{ server_version: '18.6' }],
    $disconnect: async () => {},
  };
}
