import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
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

/**
 * PostgreSQL implementation of the seed store (Prisma 7). One interactive
 * transaction per seed run. Only create/update queries exist here: the loader
 * never deletes, and learner-history foreign keys are RESTRICT anyway.
 */
export class PrismaSeedStore implements SeedStore {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (tx: SeedTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(new PrismaSeedTransaction(tx)), { maxWait: 10_000, timeout: 120_000 });
  }
}

class PrismaSeedTransaction implements SeedTransaction {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  // Sequential reads: one connection per interactive transaction.
  async readSnapshot(): Promise<ContentSnapshot> {
    const { tx } = this;
    const subjects = await tx.subject.findMany({ select: { id: true, slug: true, title: true, description: true, order: true } });
    const topics = await tx.topic.findMany({
      select: { id: true, slug: true, subjectId: true, title: true, summary: true, order: true, mapX: true, mapY: true },
    });
    const prerequisites = await tx.topicPrerequisite.findMany({ select: { topicId: true, prerequisiteId: true } });
    const lessons = await tx.lesson.findMany({
      select: { id: true, slug: true, topicId: true, title: true, body: true, estimatedMinutes: true, order: true },
    });
    const resources = await tx.resource.findMany({
      select: { id: true, topicId: true, key: true, type: true, title: true, author: true, url: true, languages: true, whyUseful: true, order: true },
    });
    const quizzes = await tx.quiz.findMany({ select: { id: true, slug: true, subjectId: true, topicId: true, title: true, kind: true } });
    const questions = await tx.question.findMany({
      select: {
        id: true, quizId: true, topicId: true, key: true, type: true, prompt: true, explanation: true, order: true,
        _count: { select: { answers: true } },
      },
    });
    const options = await tx.answerOption.findMany({
      select: { id: true, questionId: true, key: true, text: true, isCorrect: true, order: true, _count: { select: { answers: true } } },
    });
    return {
      subjects,
      topics,
      prerequisites,
      lessons,
      resources,
      quizzes,
      questions: questions.map(({ _count, ...q }) => ({ ...q, answerCount: _count.answers })),
      options: options.map(({ _count, ...o }) => ({ ...o, selectedCount: _count.answers })),
    };
  }

  async createSubject(input: { slug: string } & SubjectData) {
    return (await this.tx.subject.create({ data: input, select: { id: true } })).id;
  }
  async updateSubject(id: string, data: SubjectData) {
    await this.tx.subject.update({ where: { id }, data });
  }
  async createTopic(input: { slug: string; subjectId: string } & TopicData) {
    return (await this.tx.topic.create({ data: input, select: { id: true } })).id;
  }
  async updateTopic(id: string, data: TopicData) {
    await this.tx.topic.update({ where: { id }, data });
  }
  async createPrerequisite(input: SnapshotPrerequisite) {
    await this.tx.topicPrerequisite.create({ data: input });
  }
  async createLesson(input: { slug: string; topicId: string } & LessonData) {
    return (await this.tx.lesson.create({ data: input, select: { id: true } })).id;
  }
  async updateLesson(id: string, data: LessonData) {
    await this.tx.lesson.update({ where: { id }, data });
  }
  async createResource(input: { key: string; topicId: string } & ResourceData) {
    return (await this.tx.resource.create({ data: input, select: { id: true } })).id;
  }
  async updateResource(id: string, data: ResourceData) {
    await this.tx.resource.update({ where: { id }, data });
  }
  async createQuiz(input: { slug: string; subjectId: string; topicId: string | null } & QuizData) {
    return (await this.tx.quiz.create({ data: input, select: { id: true } })).id;
  }
  async updateQuiz(id: string, data: QuizData) {
    await this.tx.quiz.update({ where: { id }, data });
  }
  async createQuestion(input: { key: string; quizId: string; topicId: string } & QuestionData) {
    return (await this.tx.question.create({ data: input, select: { id: true } })).id;
  }
  async updateQuestion(id: string, data: QuestionData) {
    await this.tx.question.update({ where: { id }, data });
  }
  async createOption(input: { key: string; questionId: string } & OptionData) {
    return (await this.tx.answerOption.create({ data: input, select: { id: true } })).id;
  }
  async updateOption(id: string, data: OptionData) {
    await this.tx.answerOption.update({ where: { id }, data });
  }
}
