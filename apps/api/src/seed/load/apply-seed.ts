import type { SeedOperation } from './plan-seed.js';
import type { ContentSnapshot, SeedWriter } from './types.js';

/**
 * Applies a seed plan through a writer, in the plan's dependency order
 * (subjects → topics → prerequisites → lessons → resources → quizzes → questions → options).
 * Parent ids come from the snapshot or from records created earlier in the same run.
 * Call it inside SeedStore.transaction so a failure leaves the database unchanged.
 */
export async function applySeedPlan(writer: SeedWriter, operations: SeedOperation[], snapshot: ContentSnapshot): Promise<void> {
  const quizSlugById = new Map(snapshot.quizzes.map((q) => [q.id, q.slug]));
  const subjectIds = new Map(snapshot.subjects.map((s) => [s.slug, s.id]));
  const topicIds = new Map(snapshot.topics.map((t) => [t.slug, t.id]));
  const quizIds = new Map(snapshot.quizzes.map((q) => [q.slug, q.id]));
  const questionIds = new Map(snapshot.questions.map((q) => [`${quizSlugById.get(q.quizId)}/${q.key}`, q.id]));

  const need = (map: Map<string, string>, key: string, what: string): string => {
    const id = map.get(key);
    if (!id) throw new Error(`Seed apply: ${what} "${key}" was neither in the database nor created earlier in this run`);
    return id;
  };

  for (const op of operations) {
    switch (op.entity) {
      case 'subject':
        if (op.action === 'create') subjectIds.set(op.parents.slug, await writer.createSubject({ slug: op.parents.slug, ...op.data }));
        else await writer.updateSubject(op.id, op.data);
        break;
      case 'topic':
        if (op.action === 'create') {
          const subjectId = need(subjectIds, op.parents.subjectSlug, 'subject');
          topicIds.set(op.parents.slug, await writer.createTopic({ slug: op.parents.slug, subjectId, ...op.data }));
        } else await writer.updateTopic(op.id, op.data);
        break;
      case 'prerequisite':
        await writer.createPrerequisite({
          topicId: need(topicIds, op.parents.topicSlug, 'topic'),
          prerequisiteId: need(topicIds, op.parents.prerequisiteSlug, 'topic'),
        });
        break;
      case 'lesson':
        if (op.action === 'create') await writer.createLesson({ slug: op.parents.slug, topicId: need(topicIds, op.parents.topicSlug, 'topic'), ...op.data });
        else await writer.updateLesson(op.id, op.data);
        break;
      case 'resource':
        if (op.action === 'create') await writer.createResource({ key: op.parents.key, topicId: need(topicIds, op.parents.topicSlug, 'topic'), ...op.data });
        else await writer.updateResource(op.id, op.data);
        break;
      case 'quiz':
        if (op.action === 'create') {
          const id = await writer.createQuiz({
            slug: op.parents.slug,
            subjectId: need(subjectIds, op.parents.subjectSlug, 'subject'),
            topicId: need(topicIds, op.parents.topicSlug, 'topic'),
            ...op.data,
          });
          quizIds.set(op.parents.slug, id);
        } else await writer.updateQuiz(op.id, op.data);
        break;
      case 'question':
        if (op.action === 'create') {
          const id = await writer.createQuestion({
            key: op.parents.key,
            quizId: need(quizIds, op.parents.quizSlug, 'quiz'),
            topicId: need(topicIds, op.parents.topicSlug, 'topic'),
            ...op.data,
          });
          questionIds.set(`${op.parents.quizSlug}/${op.parents.key}`, id);
        } else await writer.updateQuestion(op.id, op.data);
        break;
      case 'option':
        if (op.action === 'create') {
          await writer.createOption({
            key: op.parents.key,
            questionId: need(questionIds, `${op.parents.quizSlug}/${op.parents.questionKey}`, 'question'),
            ...op.data,
          });
        } else await writer.updateOption(op.id, op.data);
        break;
    }
  }
}
