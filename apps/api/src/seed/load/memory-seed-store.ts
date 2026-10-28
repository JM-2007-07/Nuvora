import type {
  ContentSnapshot,
  LessonData,
  OptionData,
  QuestionData,
  QuizData,
  ResourceData,
  SeedStore,
  SeedTransaction,
  SnapshotPrerequisite,
  SubjectData,
  TopicData,
} from './types.js';
import { emptySnapshot } from './types.js';

/**
 * In-memory seed store for tests (no PostgreSQL). Each transaction works on a
 * copy of the state and commits it only if the work succeeds, like a database
 * transaction. Counters let tests prove that nothing was written.
 */
export class MemorySeedStore implements SeedStore {
  state: ContentSnapshot = emptySnapshot();
  transactions = 0;
  writes = 0;
  /** Makes the n-th write in a transaction throw, to test rollback. */
  failOnWrite?: number;
  private nextId = 1;

  async transaction<T>(work: (tx: SeedTransaction) => Promise<T>): Promise<T> {
    this.transactions++;
    const draft = structuredClone(this.state);
    let writesInTx = 0;
    const write = () => {
      writesInTx++;
      if (this.failOnWrite !== undefined && writesInTx === this.failOnWrite) throw new Error('simulated database failure');
    };
    const id = (prefix: string) => `${prefix}_${this.nextId++}`;
    const patch = <R extends { id: string }>(rows: R[], rowId: string, data: object) => {
      write();
      const row = rows.find((r) => r.id === rowId);
      if (!row) throw new Error(`no row ${rowId}`);
      Object.assign(row, structuredClone(data));
    };

    const tx: SeedTransaction = {
      readSnapshot: async () => structuredClone(draft),
      createSubject: async (input: { slug: string } & SubjectData) => {
        write();
        const row = { id: id('subject'), ...structuredClone(input) };
        draft.subjects.push(row);
        return row.id;
      },
      updateSubject: async (rowId, data) => patch(draft.subjects, rowId, data),
      createTopic: async (input: { slug: string; subjectId: string } & TopicData) => {
        write();
        const row = { id: id('topic'), ...structuredClone(input) };
        draft.topics.push(row);
        return row.id;
      },
      updateTopic: async (rowId, data) => patch(draft.topics, rowId, data),
      createPrerequisite: async (input: SnapshotPrerequisite) => {
        write();
        draft.prerequisites.push({ ...input });
      },
      createLesson: async (input: { slug: string; topicId: string } & LessonData) => {
        write();
        const row = { id: id('lesson'), ...structuredClone(input) };
        draft.lessons.push(row);
        return row.id;
      },
      updateLesson: async (rowId, data) => patch(draft.lessons, rowId, data),
      createResource: async (input: { key: string; topicId: string } & ResourceData) => {
        write();
        const row = { id: id('resource'), ...structuredClone(input) };
        draft.resources.push(row);
        return row.id;
      },
      updateResource: async (rowId, data) => patch(draft.resources, rowId, data),
      createQuiz: async (input: { slug: string; subjectId: string; topicId: string | null } & QuizData) => {
        write();
        const row = { id: id('quiz'), ...structuredClone(input) };
        draft.quizzes.push(row);
        return row.id;
      },
      updateQuiz: async (rowId, data) => patch(draft.quizzes, rowId, data),
      createQuestion: async (input: { key: string; quizId: string; topicId: string } & QuestionData) => {
        write();
        const row = { id: id('question'), answerCount: 0, ...structuredClone(input) };
        draft.questions.push(row);
        return row.id;
      },
      updateQuestion: async (rowId, data) => patch(draft.questions, rowId, data),
      createOption: async (input: { key: string; questionId: string } & OptionData) => {
        write();
        const row = { id: id('option'), selectedCount: 0, ...structuredClone(input) };
        draft.options.push(row);
        return row.id;
      },
      updateOption: async (rowId, data) => patch(draft.options, rowId, data),
    };

    const result = await work(tx);
    this.state = draft;
    this.writes += writesInTx;
    return result;
  }

  /** Test helper: pretend learners answered `questionKey` of `quizSlug`, choosing `optionKey`. */
  recordAnswers(quizSlug: string, questionKey: string, optionKey: string, count = 1): void {
    const quiz = this.state.quizzes.find((q) => q.slug === quizSlug);
    const question = this.state.questions.find((q) => q.quizId === quiz?.id && q.key === questionKey);
    const option = this.state.options.find((o) => o.questionId === question?.id && o.key === optionKey);
    if (!question || !option) throw new Error(`unknown question/option ${quizSlug}/${questionKey}/${optionKey}`);
    question.answerCount += count;
    option.selectedCount += count;
  }

  counts(): Record<keyof ContentSnapshot, number> {
    return Object.fromEntries(Object.entries(this.state).map(([k, rows]) => [k, (rows as unknown[]).length])) as Record<keyof ContentSnapshot, number>;
  }
}
