import type { SubjectContent, TopicContent } from '@nuvora/shared';
import type {
  ContentSnapshot,
  LessonData,
  OptionData,
  QuestionData,
  QuizData,
  ResourceData,
  SubjectData,
  TopicData,
} from './types.js';

/**
 * Seed planner (G3.1). Pure: compares validated content with a database snapshot
 * and returns ordered create/update operations plus issues. No I/O.
 *
 * Rules (docs/04-data/data-model.md#seed-loader):
 * - Records are matched by stable slug (subject, topic, lesson, quiz) or key
 *   (resource per topic, question per quiz, option per question).
 * - Unchanged records produce no operation, so re-running is a no-op.
 * - Nothing is ever deleted. Database content missing from the seed files is a
 *   blocking error, as is moving a record to a different parent.
 * - A question with recorded answers may not change its meaning: type, option
 *   keys, or which option is correct. Text edits are allowed but reported.
 */

export type SeedEntity = 'subject' | 'topic' | 'prerequisite' | 'lesson' | 'resource' | 'quiz' | 'question' | 'option';

type Create<E extends SeedEntity, P, D> = { entity: E; action: 'create'; ref: string; parents: P; data: D };
type Update<E extends SeedEntity, D> = { entity: E; action: 'update'; ref: string; id: string; data: D; changed: string[] };

export type SeedOperation =
  | Create<'subject', { slug: string }, SubjectData>
  | Update<'subject', SubjectData>
  | Create<'topic', { slug: string; subjectSlug: string }, TopicData>
  | Update<'topic', TopicData>
  | Create<'prerequisite', { topicSlug: string; prerequisiteSlug: string }, Record<string, never>>
  | Create<'lesson', { slug: string; topicSlug: string }, LessonData>
  | Update<'lesson', LessonData>
  | Create<'resource', { key: string; topicSlug: string }, ResourceData>
  | Update<'resource', ResourceData>
  | Create<'quiz', { slug: string; subjectSlug: string; topicSlug: string }, QuizData>
  | Update<'quiz', QuizData>
  | Create<'question', { key: string; quizSlug: string; topicSlug: string }, QuestionData>
  | Update<'question', QuestionData>
  | Create<'option', { key: string; quizSlug: string; questionKey: string }, OptionData>
  | Update<'option', OptionData>;

export interface PlanIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export interface SeedPlan {
  operations: SeedOperation[];
  issues: PlanIssue[];
  errors: number;
  summary: Record<SeedEntity, { create: number; update: number; unchanged: number }>;
}

export interface ParsedContent {
  subjects: SubjectContent[];
  topics: TopicContent[];
}

const NEVER_DELETES =
  'exists in the database but not in the seed files. The loader never deletes content: restore it in the seed files, or remove it deliberately outside the loader (deletion policy).';

/** Key-order-independent JSON for structural comparison of stored values. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function changedFields<D extends object>(existing: Record<string, unknown>, data: D): string[] {
  return Object.keys(data).filter((field) => stable(existing[field]) !== stable((data as Record<string, unknown>)[field]));
}

export function planSeed(content: ParsedContent, snapshot: ContentSnapshot): SeedPlan {
  const operations: SeedOperation[] = [];
  const issues: PlanIssue[] = [];
  const entities: SeedEntity[] = ['subject', 'topic', 'prerequisite', 'lesson', 'resource', 'quiz', 'question', 'option'];
  const summary = Object.fromEntries(entities.map((e) => [e, { create: 0, update: 0, unchanged: 0 }])) as SeedPlan['summary'];
  const error = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });

  /** Records an upsert decision and returns the existing id (if any). */
  function upsert<E extends SeedEntity, P, D extends object>(
    entity: E,
    ref: string,
    existing: ({ id: string } & Record<string, unknown>) | undefined,
    parents: P,
    data: D,
  ): void {
    if (!existing) {
      operations.push({ entity, action: 'create', ref, parents, data } as unknown as SeedOperation);
      summary[entity].create++;
      return;
    }
    const changed = changedFields(existing, data);
    if (changed.length === 0) {
      summary[entity].unchanged++;
      return;
    }
    operations.push({ entity, action: 'update', ref, id: existing.id, data, changed } as unknown as SeedOperation);
    summary[entity].update++;
  }

  // ---- Indexes over the snapshot ----
  const subjectBySlug = new Map(snapshot.subjects.map((s) => [s.slug, s]));
  const subjectSlugById = new Map(snapshot.subjects.map((s) => [s.id, s.slug]));
  const topicBySlug = new Map(snapshot.topics.map((t) => [t.slug, t]));
  const topicSlugById = new Map(snapshot.topics.map((t) => [t.id, t.slug]));
  const lessonBySlug = new Map(snapshot.lessons.map((l) => [l.slug, l]));
  const resourceByRef = new Map(snapshot.resources.map((r) => [`${r.topicId}/${r.key}`, r]));
  const quizBySlug = new Map(snapshot.quizzes.map((q) => [q.slug, q]));
  const quizSlugById = new Map(snapshot.quizzes.map((q) => [q.id, q.slug]));
  const questionByRef = new Map(snapshot.questions.map((q) => [`${q.quizId}/${q.key}`, q]));
  const optionsByQuestionId = new Map<string, typeof snapshot.options>();
  for (const option of snapshot.options) {
    optionsByQuestionId.set(option.questionId, [...(optionsByQuestionId.get(option.questionId) ?? []), option]);
  }

  const seen = { subjects: new Set<string>(), topics: new Set<string>(), lessons: new Set<string>(), resources: new Set<string>(), quizzes: new Set<string>(), questions: new Set<string>(), options: new Set<string>(), prerequisites: new Set<string>() };

  // A record that already exists under a different parent cannot be re-homed.
  const checkParent = (where: string, kind: string, actual: string | null | undefined, expected: string | undefined) => {
    if (expected !== undefined && actual !== expected) {
      error(where, `This ${kind} already exists under a different parent in the database. Moving content between parents is not supported; use a new slug/key.`);
      return false;
    }
    return true;
  };

  // ---- Subjects ----
  for (const subject of content.subjects) {
    const existing = subjectBySlug.get(subject.slug);
    if (existing) seen.subjects.add(existing.id);
    upsert('subject', `subject "${subject.slug}"`, existing, { slug: subject.slug }, {
      title: subject.title,
      description: subject.description,
      order: subject.order,
    } satisfies SubjectData);
  }

  // ---- Topics ----
  for (const topic of content.topics) {
    const where = `topic "${topic.slug}"`;
    const existing = topicBySlug.get(topic.slug);
    if (existing) {
      seen.topics.add(existing.id);
      checkParent(where, 'topic', subjectSlugById.get(existing.subjectId), topic.subject);
    }
    upsert('topic', where, existing, { slug: topic.slug, subjectSlug: topic.subject }, {
      title: topic.title,
      summary: topic.summary,
      order: topic.order,
      mapX: topic.map.column,
      mapY: topic.map.row,
    } satisfies TopicData);
  }

  // ---- Prerequisite edges (after every topic exists) ----
  const existingEdges = new Set(snapshot.prerequisites.map((p) => `${topicSlugById.get(p.topicId)}->${topicSlugById.get(p.prerequisiteId)}`));
  for (const topic of content.topics) {
    for (const prerequisite of topic.prerequisites) {
      const edge = `${topic.slug}->${prerequisite}`;
      seen.prerequisites.add(edge);
      if (existingEdges.has(edge)) {
        summary.prerequisite.unchanged++;
      } else {
        operations.push({ entity: 'prerequisite', action: 'create', ref: `prerequisite ${edge}`, parents: { topicSlug: topic.slug, prerequisiteSlug: prerequisite }, data: {} });
        summary.prerequisite.create++;
      }
    }
  }

  // ---- Lessons, resources, quiz, questions, options per topic ----
  for (const topic of content.topics) {
    const topicId = topicBySlug.get(topic.slug)?.id;

    topic.lessons.forEach((lesson, order) => {
      const where = `lesson "${lesson.slug}"`;
      const existing = lessonBySlug.get(lesson.slug);
      if (existing) {
        seen.lessons.add(existing.id);
        checkParent(where, 'lesson', topicSlugById.get(existing.topicId), topic.slug);
      }
      upsert('lesson', where, existing, { slug: lesson.slug, topicSlug: topic.slug }, {
        title: lesson.title,
        body: lesson.body,
        estimatedMinutes: lesson.estimatedMinutes,
        order,
      } satisfies LessonData);
    });

    topic.resources.forEach((resource, order) => {
      const existing = topicId ? resourceByRef.get(`${topicId}/${resource.key}`) : undefined;
      if (existing) seen.resources.add(existing.id);
      upsert('resource', `topic "${topic.slug}" › resource "${resource.key}"`, existing, { key: resource.key, topicSlug: topic.slug }, {
        type: resource.type,
        title: resource.title,
        author: resource.author,
        url: resource.url ?? null,
        languages: resource.languages,
        whyUseful: resource.whyUseful,
        order,
      } satisfies ResourceData);
    });

    const quiz = topic.quiz;
    const quizWhere = `quiz "${quiz.slug}"`;
    const existingQuiz = quizBySlug.get(quiz.slug);
    if (existingQuiz) {
      seen.quizzes.add(existingQuiz.id);
      checkParent(quizWhere, 'quiz', existingQuiz.topicId ? topicSlugById.get(existingQuiz.topicId) : null, topic.slug);
    }
    upsert('quiz', quizWhere, existingQuiz, { slug: quiz.slug, subjectSlug: topic.subject, topicSlug: topic.slug }, {
      title: quiz.title,
      kind: 'TOPIC',
    } satisfies QuizData);

    quiz.questions.forEach((question, order) => {
      const qWhere = `${quizWhere} › question "${question.key}"`;
      const existing = existingQuiz ? questionByRef.get(`${existingQuiz.id}/${question.key}`) : undefined;
      const existingOptions = existing ? (optionsByQuestionId.get(existing.id) ?? []) : [];

      if (existing) {
        seen.questions.add(existing.id);
        checkParent(qWhere, 'question', topicSlugById.get(existing.topicId), topic.slug);

        if (existing.answerCount > 0) {
          const meaning = `It has ${existing.answerCount} recorded answer(s), so its meaning is frozen: give the changed question a new key (data-model.md#published-questions-keep-their-meaning).`;
          const newKeys = question.options.map((o) => o.key).sort().join(',');
          const oldKeys = existingOptions.map((o) => o.key).sort().join(',');
          const newCorrect = question.options.find((o) => o.correct)?.key;
          const oldCorrect = existingOptions.find((o) => o.isCorrect)?.key;
          if (existing.type !== question.type) error(qWhere, `Question type would change. ${meaning}`);
          if (newKeys !== oldKeys) error(qWhere, `Answer options would change (${oldKeys} → ${newKeys}). ${meaning}`);
          else if (newCorrect !== oldCorrect) error(qWhere, `The correct option would change (${oldCorrect} → ${newCorrect}). ${meaning}`);
          if (stable(existing.prompt) !== stable(question.prompt) || stable(existing.explanation) !== stable(question.explanation)) {
            warn(qWhere, `Text changed on a question with ${existing.answerCount} recorded answer(s). Allowed only for typo or translation fixes, never a change of meaning.`);
          }
        }
      }

      upsert('question', qWhere, existing, { key: question.key, quizSlug: quiz.slug, topicSlug: topic.slug }, {
        type: question.type,
        prompt: question.prompt,
        explanation: question.explanation,
        order,
      } satisfies QuestionData);

      const optionByKey = new Map(existingOptions.map((o) => [o.key, o]));
      question.options.forEach((option, optionOrder) => {
        const oWhere = `${qWhere} › option "${option.key}"`;
        const existingOption = optionByKey.get(option.key);
        if (existingOption) {
          seen.options.add(existingOption.id);
          if (existingOption.selectedCount > 0 && stable(existingOption.text) !== stable(option.text)) {
            warn(oWhere, `Text changed on an option chosen in ${existingOption.selectedCount} recorded answer(s). Allowed only for typo or translation fixes.`);
          }
        }
        upsert('option', oWhere, existingOption, { key: option.key, quizSlug: quiz.slug, questionKey: question.key }, {
          text: option.text,
          isCorrect: option.correct,
          order: optionOrder,
        } satisfies OptionData);
      });
    });
  }

  // ---- Database content that the seed files no longer contain: never deleted, always reported ----
  for (const s of snapshot.subjects) if (!seen.subjects.has(s.id)) error(`subject "${s.slug}"`, NEVER_DELETES);
  for (const t of snapshot.topics) if (!seen.topics.has(t.id)) error(`topic "${t.slug}"`, NEVER_DELETES);
  for (const edge of existingEdges) if (!seen.prerequisites.has(edge)) error(`prerequisite ${edge}`, NEVER_DELETES);
  for (const l of snapshot.lessons) if (!seen.lessons.has(l.id)) error(`lesson "${l.slug}"`, NEVER_DELETES);
  for (const r of snapshot.resources) if (!seen.resources.has(r.id)) error(`topic "${topicSlugById.get(r.topicId)}" › resource "${r.key}"`, NEVER_DELETES);
  for (const q of snapshot.quizzes) if (!seen.quizzes.has(q.id)) error(`quiz "${q.slug}"`, NEVER_DELETES);
  for (const q of snapshot.questions) if (!seen.questions.has(q.id)) error(`quiz "${quizSlugById.get(q.quizId)}" › question "${q.key}"`, NEVER_DELETES);
  const questionById = new Map(snapshot.questions.map((q) => [q.id, q]));
  for (const o of snapshot.options) {
    if (!seen.options.has(o.id)) {
      const q = questionById.get(o.questionId);
      error(`quiz "${q ? quizSlugById.get(q.quizId) : '?'}" › question "${q?.key}" › option "${o.key}"`, NEVER_DELETES);
    }
  }

  return { operations, issues, errors: issues.filter((i) => i.level === 'error').length, summary };
}
