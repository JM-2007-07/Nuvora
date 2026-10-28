import type { Locale, Recommendation } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { RecommendationRef, TopicState } from '../recommendations/recommend.js';

type Db = Prisma.TransactionClient;

const stateSelect = {
  slug: true,
  title: true,
  order: true,
  prerequisites: { select: { prerequisite: { select: { slug: true } } } },
  lessons: { orderBy: [{ order: 'asc' }, { slug: 'asc' }], take: 1, select: { id: true, slug: true, title: true } },
  resources: {
    orderBy: [{ order: 'asc' }, { key: 'asc' }],
    take: 1,
    select: { key: true, type: true, title: true, author: true, url: true, languages: true, whyUseful: true },
  },
} satisfies Prisma.TopicSelect;

type TopicRow = Prisma.TopicGetPayload<{ select: typeof stateSelect }> & { id: string };

export interface SubjectLearningState {
  topics: TopicState[];
  rows: Map<string, TopicRow>;
}

/** The learner's state for every topic of a subject: mastery, lesson completion, first lesson/resource. */
export async function loadLearningState(db: Db, userId: string, subjectId: string): Promise<SubjectLearningState> {
  const rows = await db.topic.findMany({
    where: { subjectId },
    orderBy: [{ order: 'asc' }, { slug: 'asc' }],
    select: { id: true, ...stateSelect },
  });
  const masteries = await db.topicMastery.findMany({ where: { userId, topicId: { in: rows.map((r) => r.id) } }, select: { topicId: true, status: true, scorePercent: true } });
  const lessonIds = rows.flatMap((r) => r.lessons.map((l) => l.id));
  const completed = new Set(
    (await db.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } }, select: { lessonId: true } })).map((p) => p.lessonId),
  );
  const masteryByTopic = new Map(masteries.map((m) => [m.topicId, m]));

  const topics: TopicState[] = rows.map((row) => {
    const mastery = masteryByTopic.get(row.id);
    const lesson = row.lessons[0];
    return {
      slug: row.slug,
      order: row.order,
      prerequisites: row.prerequisites.map((p) => p.prerequisite.slug),
      status: mastery?.status ?? 'NOT_STARTED',
      scorePercent: mastery?.scorePercent ?? null,
      lessonSlug: lesson?.slug ?? null,
      lessonCompleted: lesson ? completed.has(lesson.id) : false,
      firstResourceKey: row.resources[0]?.key ?? null,
    };
  });
  return { topics, rows: new Map(rows.map((r) => [r.slug, r])) };
}

/** Turns rule output into localized API DTOs. */
export function toRecommendationDtos(refs: RecommendationRef[], state: SubjectLearningState, locale: Locale): Recommendation[] {
  const ref = (slug: string) => {
    const row = state.rows.get(slug)!;
    return { slug: row.slug, ...localizeFields(locale, { title: row.title }) };
  };
  return refs.map((r) => {
    const row = state.rows.get(r.topicSlug)!;
    const lesson = r.target.kind === 'LESSON' ? row.lessons[0] : undefined;
    const resource = r.target.kind === 'RESOURCE' ? row.resources[0] : undefined;
    return {
      reason: r.reason,
      topic: ref(r.topicSlug),
      forTopic: r.reason === 'PREREQUISITE' ? ref(r.forTopicSlug) : null,
      scorePercent: r.reason === 'WEAK_TOPIC' ? r.scorePercent : null,
      lesson: lesson ? { slug: lesson.slug, ...localizeFields(locale, { title: lesson.title }) } : null,
      resource: resource
        ? {
            key: resource.key,
            type: resource.type,
            author: resource.author,
            url: resource.url,
            languages: resource.languages,
            ...localizeFields(locale, { title: resource.title, whyUseful: resource.whyUseful }),
          }
        : null,
    };
  });
}
