import type { TopicContentInput } from '@nuvora/shared';
import { type ContentSet, content as fullContent } from '../content/index.js';
import { FIXTURES, TEMPLATE_CONTENT as content } from '../fixtures.js';
import { MemorySeedStore } from './memory-seed-store.js';
import { seedContent } from './seed-content.js';

/** A second, valid topic that depends on "variables" (new slugs and keys). */
function withConditionsTopic(base: ContentSet = content): ContentSet {
  const set = structuredClone(base);
  const conditions: TopicContentInput = structuredClone(set.topics[0]);
  conditions.slug = 'conditions';
  conditions.order = 2;
  conditions.prerequisites = ['variables'];
  conditions.map = { column: 1, row: 0 };
  conditions.lessons[0].slug = 'conditions-lesson';
  conditions.quiz.slug = 'conditions-quiz';
  set.topics.push(conditions);
  return set;
}

const variablesOf = (set: ContentSet) => set.topics.find((t) => t.slug === 'variables')!;

describe('db:seed loader (in-memory store, no PostgreSQL)', () => {
  let store: MemorySeedStore;
  beforeEach(() => {
    store = new MemorySeedStore();
  });

  it('initial load creates every record in dependency order', async () => {
    const result = await seedContent(store, content);
    expect(result.status).toBe('applied');
    expect(store.counts()).toEqual({
      subjects: 1, topics: 1, prerequisites: 0, lessons: 1, resources: 2, quizzes: 1, questions: 4, options: 16,
    });
    const quiz = store.state.quizzes[0];
    expect(quiz).toMatchObject({ slug: 'variables-quiz', kind: 'TOPIC', topicId: store.state.topics[0].id, subjectId: store.state.subjects[0].id });
    const reassign = store.state.questions.find((q) => q.key === 'reassign')!;
    expect(store.state.options.filter((o) => o.questionId === reassign.id && o.isCorrect).map((o) => o.key)).toEqual(['b']);
    expect(store.state.questions.map((q) => q.order)).toEqual([0, 1, 2, 3]);
  });

  it('repeated load is a no-op: no duplicates, no writes', async () => {
    await seedContent(store, content);
    const before = structuredClone(store.state);
    const writes = store.writes;

    const again = await seedContent(store, content);
    expect(again.status).toBe('unchanged');
    expect(again.plan?.operations).toEqual([]);
    expect(store.writes).toBe(writes);
    expect(store.state).toEqual(before);
  });

  it('content edits update records in place and keep their ids', async () => {
    await seedContent(store, content);
    const lessonId = store.state.lessons[0].id;
    const edited = structuredClone(content);
    variablesOf(edited).lessons[0].title.en = 'Variables and basic data types (revised)';
    variablesOf(edited).resources[1].whyUseful.en = 'Chapter 1 covers variables. Free online.';

    const result = await seedContent(store, edited);
    expect(result.status).toBe('applied');
    expect(result.plan?.operations.map((o) => `${o.action} ${o.ref}`)).toEqual([
      'update lesson "variables-and-data-types"',
      'update topic "variables" › resource "automate-the-boring-stuff"',
    ]);
    expect(store.state.lessons[0]).toMatchObject({ id: lessonId, title: { en: 'Variables and basic data types (revised)' } });
    expect(store.counts().lessons).toBe(1);
  });

  it('new topics, prerequisites, and questions are added; existing ones untouched', async () => {
    await seedContent(store, content);
    const result = await seedContent(store, withConditionsTopic());
    expect(result.status).toBe('applied');
    expect(result.plan?.summary.topic).toEqual({ create: 1, update: 0, unchanged: 1 });
    expect(result.plan?.summary.prerequisite).toEqual({ create: 1, update: 0, unchanged: 0 });
    const [variables, conditions] = ['variables', 'conditions'].map((slug) => store.state.topics.find((t) => t.slug === slug)!);
    expect(store.state.prerequisites).toEqual([{ topicId: conditions.id, prerequisiteId: variables.id }]);
  });

  describe('deletion safety', () => {
    it('never deletes: content missing from the files blocks the run and nothing is written', async () => {
      await seedContent(store, withConditionsTopic());
      const before = structuredClone(store.state);
      const writes = store.writes;

      const result = await seedContent(store, content); // "conditions" topic removed from the files
      expect(result.status).toBe('blocked');
      const blocked = result.plan!.issues.filter((i) => i.level === 'error').map((i) => i.where);
      expect(blocked).toEqual(expect.arrayContaining(['topic "conditions"', 'lesson "conditions-lesson"', 'quiz "conditions-quiz"', 'prerequisite conditions->variables']));
      expect(result.plan!.issues[0].message).toMatch(/never deletes content/);
      expect(store.writes).toBe(writes);
      expect(store.state).toEqual(before);
    });

    it('a removed answer option is reported, not deleted', async () => {
      await seedContent(store, content);
      const edited = structuredClone(content);
      variablesOf(edited).quiz.questions[0].options.pop();
      const result = await seedContent(store, edited);
      expect(result.status).toBe('blocked');
      expect(result.plan!.issues.map((i) => i.where)).toContain('quiz "variables-quiz" › question "reassign" › option "d"');
      expect(store.counts().options).toBe(16);
    });

    it('moving a lesson to another topic is refused', async () => {
      await seedContent(store, withConditionsTopic());
      const moved = withConditionsTopic();
      const [variables, conditions] = moved.topics;
      conditions.lessons[0].slug = variables.lessons[0].slug;
      variables.lessons[0].slug = 'variables-lesson-renamed';
      const result = await seedContent(store, moved);
      expect(result.status).toBe('blocked');
      expect(result.plan!.issues.find((i) => i.where === 'lesson "variables-and-data-types"')?.message).toMatch(/different parent/);
    });
  });

  describe('answered questions keep their meaning', () => {
    beforeEach(async () => {
      await seedContent(store, content);
      store.recordAnswers('variables-quiz', 'reassign', 'b', 3);
    });

    it('blocks changing which option is correct', async () => {
      const edited = structuredClone(content);
      for (const option of variablesOf(edited).quiz.questions[0].options) option.correct = option.key === 'a';
      const result = await seedContent(store, edited);
      expect(result.status).toBe('blocked');
      expect(result.plan!.issues).toContainEqual(
        expect.objectContaining({ level: 'error', where: 'quiz "variables-quiz" › question "reassign"', message: expect.stringMatching(/correct option would change \(b → a\).*3 recorded answer/) }),
      );
    });

    it('blocks adding an option', async () => {
      const edited = structuredClone(content);
      variablesOf(edited).quiz.questions[0].options.push({ key: 'e', correct: false, text: { tg: '9', ru: '9', en: '9' } });
      const result = await seedContent(store, edited);
      expect(result.status).toBe('blocked');
      expect(result.plan!.issues.some((i) => /Answer options would change \(a,b,c,d → a,b,c,d,e\)/.test(i.message))).toBe(true);
    });

    it('allows a typo fix in place, with a warning', async () => {
      const edited = structuredClone(content);
      variablesOf(edited).quiz.questions[0].explanation.en += ' ';
      variablesOf(edited).quiz.questions[0].explanation.en = variablesOf(edited).quiz.questions[0].explanation.en.replace('First', 'At first');
      const result = await seedContent(store, edited);
      expect(result.status).toBe('applied');
      expect(result.plan!.issues).toEqual([
        expect.objectContaining({ level: 'warning', where: 'quiz "variables-quiz" › question "reassign"', message: expect.stringMatching(/typo or translation fixes/) }),
      ]);
    });

    it('unanswered questions can still change freely', async () => {
      const edited = structuredClone(content);
      for (const option of variablesOf(edited).quiz.questions[1].options) option.correct = option.key === 'a';
      const result = await seedContent(store, edited);
      expect(result.status).toBe('applied');
    });
  });

  it('loads the full six-topic Informatics content with its prerequisite graph, idempotently', async () => {
    const result = await seedContent(store, fullContent);
    expect(result.status).toBe('applied');
    expect(store.counts()).toEqual({
      subjects: 1, topics: 6, prerequisites: 6, lessons: 6, resources: 11, quizzes: 6, questions: 24, options: 96,
    });
    const slugById = new Map(store.state.topics.map((t) => [t.id, t.slug]));
    expect(store.state.prerequisites.map((p) => `${slugById.get(p.topicId)}->${slugById.get(p.prerequisiteId)}`).sort()).toEqual([
      'algorithms->functions', 'algorithms->lists', 'conditions->variables', 'functions->variables', 'lists->loops', 'loops->conditions',
    ]);
    expect((await seedContent(store, fullContent)).status).toBe('unchanged');
  });

  it('validation runs first: invalid content never opens a transaction', async () => {
    const result = await seedContent(store, FIXTURES['missing-translation']);
    expect(result.status).toBe('invalid');
    expect(store.transactions).toBe(0);
  });

  it('dry run plans without writing', async () => {
    const result = await seedContent(store, content, { dryRun: true });
    expect(result.status).toBe('dry-run');
    expect(result.plan?.operations.length).toBeGreaterThan(0);
    expect(store.writes).toBe(0);
    expect(store.counts().subjects).toBe(0);
  });

  it('a failure mid-run rolls back everything (one transaction)', async () => {
    store.failOnWrite = 10;
    await expect(seedContent(store, content)).rejects.toThrow('simulated database failure');
    expect(store.counts()).toEqual({ subjects: 0, topics: 0, prerequisites: 0, lessons: 0, resources: 0, quizzes: 0, questions: 0, options: 0 });
    store.failOnWrite = undefined;
    expect((await seedContent(store, content)).status).toBe('applied');
  });
});
