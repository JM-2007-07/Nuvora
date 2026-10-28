import type { MasteryStatus } from '@nuvora/shared';

/**
 * Recommendation rules (ADR-0004). Pure: no I/O.
 *
 * 1. Weak topics, lowest score first (ties: subject order).
 * 2. For each weak topic, first its direct prerequisites that are WEAK or
 *    NOT_STARTED (weak before not started, then subject order): their lesson.
 * 3. Then the weak topic itself: its lesson, or its first resource if the learner
 *    already completed the lesson.
 * 4. Remove duplicates; at most 3. If nothing is weak: the next topic in subject
 *    order that is not MASTERED (its lesson).
 */

export interface TopicState {
  slug: string;
  order: number;
  prerequisites: string[];
  status: MasteryStatus;
  scorePercent: number | null;
  lessonSlug: string | null;
  lessonCompleted: boolean;
  firstResourceKey: string | null;
}

export type RecommendationRef =
  | { reason: 'PREREQUISITE'; topicSlug: string; forTopicSlug: string; target: { kind: 'LESSON'; slug: string } }
  | { reason: 'WEAK_TOPIC'; topicSlug: string; scorePercent: number; target: { kind: 'LESSON'; slug: string } | { kind: 'RESOURCE'; key: string } }
  | { reason: 'NEXT_TOPIC'; topicSlug: string; target: { kind: 'LESSON'; slug: string } };

export const MAX_RECOMMENDATIONS = 3;

/**
 * @param topics every topic of the subject with the learner's current state
 * @param weakTopics the topics to act on (e.g. weak in this attempt), with scores
 */
export function recommend(topics: TopicState[], weakTopics: { slug: string; scorePercent: number }[]): RecommendationRef[] {
  const bySlug = new Map(topics.map((t) => [t.slug, t]));
  const out: RecommendationRef[] = [];
  const seen = new Set<string>();
  const push = (rec: RecommendationRef) => {
    const id = rec.target.kind === 'LESSON' ? `lesson:${rec.target.slug}` : `resource:${rec.topicSlug}/${rec.target.key}`;
    if (seen.has(id) || out.length >= MAX_RECOMMENDATIONS) return;
    seen.add(id);
    out.push(rec);
  };

  const weak = [...weakTopics]
    .filter((w) => bySlug.has(w.slug))
    .sort((a, b) => a.scorePercent - b.scorePercent || bySlug.get(a.slug)!.order - bySlug.get(b.slug)!.order);

  for (const w of weak) {
    const topic = bySlug.get(w.slug)!;
    const rank = (s: MasteryStatus) => (s === 'WEAK' ? 0 : 1);
    const prerequisites = topic.prerequisites
      .map((slug) => bySlug.get(slug))
      .filter((p): p is TopicState => !!p && (p.status === 'WEAK' || p.status === 'NOT_STARTED'))
      .sort((a, b) => rank(a.status) - rank(b.status) || a.order - b.order);
    for (const p of prerequisites) {
      if (p.lessonSlug) push({ reason: 'PREREQUISITE', topicSlug: p.slug, forTopicSlug: topic.slug, target: { kind: 'LESSON', slug: p.lessonSlug } });
    }
    if (topic.lessonCompleted && topic.firstResourceKey) {
      push({ reason: 'WEAK_TOPIC', topicSlug: topic.slug, scorePercent: w.scorePercent, target: { kind: 'RESOURCE', key: topic.firstResourceKey } });
    } else if (topic.lessonSlug) {
      push({ reason: 'WEAK_TOPIC', topicSlug: topic.slug, scorePercent: w.scorePercent, target: { kind: 'LESSON', slug: topic.lessonSlug } });
    }
  }

  if (weak.length === 0) {
    const next = [...topics].sort((a, b) => a.order - b.order).find((t) => t.status !== 'MASTERED' && t.lessonSlug);
    if (next?.lessonSlug) push({ reason: 'NEXT_TOPIC', topicSlug: next.slug, target: { kind: 'LESSON', slug: next.lessonSlug } });
  }
  return out;
}
