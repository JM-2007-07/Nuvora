import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ApiErrorSchema,
  LessonDetailSchema,
  PublicQuizSchema,
  SubjectDetailSchema,
  SubjectListResponseSchema,
  type TopicContentInput,
  TopicDetailSchema,
} from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { publicQuizSelect } from '../src/quizzes/quizzes.service.js';
import { type ContentSet, content as fullContent } from '../src/seed/content/index.js';
import { TEMPLATE_CONTENT as content } from '../src/seed/fixtures.js';
import { emptySnapshot } from '../src/seed/load/types.js';
import { type FakeContentOptions, fakeContentPrisma, snapshotOf } from './support/fake-content-prisma.js';

const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000' };
const variablesTopic = content.topics[0];

/** Real content plus a second topic "conditions" that requires "variables". */
function withConditions(): ContentSet {
  const set = structuredClone(content);
  const conditions: TopicContentInput = structuredClone(set.topics[0]);
  Object.assign(conditions, { slug: 'conditions', order: 2, prerequisites: ['variables'], map: { column: 1, row: 0 } });
  conditions.lessons[0].slug = 'conditions-lesson';
  conditions.quiz.slug = 'conditions-quiz';
  set.topics.push(conditions);
  return set;
}

async function startApp(db: Awaited<ReturnType<typeof snapshotOf>>, options?: FakeContentOptions): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(PrismaService)
    .useValue(fakeContentPrisma(db, options))
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app, env);
  await app.init();
  return app;
}

describe('Content API (e2e, in-memory data)', () => {
  let app: INestApplication<App>;
  afterEach(async () => {
    await app?.close();
  });

  describe('subjects', () => {
    it('lists published subjects in Russian by default', async () => {
      app = await startApp(await snapshotOf(content));
      const res = await request(app.getHttpServer()).get('/api/v1/subjects').expect(200);
      expect(res.headers['content-language']).toBe('ru');
      expect(res.headers.vary).toMatch(/Accept-Language/);
      expect(SubjectListResponseSchema.parse(res.body)).toEqual({
        items: [{ slug: 'informatics', title: 'Информатика', description: expect.stringContaining('Основы программирования'), topicCount: 1, fallbackFields: [] }],
      });
    });

    it('returns an empty list when there is no content', async () => {
      app = await startApp(emptySnapshot());
      const res = await request(app.getHttpServer()).get('/api/v1/subjects').expect(200);
      expect(res.body).toEqual({ items: [] });
    });

    it('hides unpublished subjects everywhere', async () => {
      app = await startApp(await snapshotOf(content), { unpublished: ['informatics'] });
      const server = app.getHttpServer();
      expect((await request(server).get('/api/v1/subjects').expect(200)).body).toEqual({ items: [] });
      for (const [path, code] of [
        ['/api/v1/subjects/informatics', 'SUBJECT_NOT_FOUND'],
        ['/api/v1/topics/variables', 'TOPIC_NOT_FOUND'],
        ['/api/v1/lessons/variables-and-data-types', 'LESSON_NOT_FOUND'],
        ['/api/v1/quizzes/variables-quiz', 'QUIZ_NOT_FOUND'],
      ]) {
        const res = await request(server).get(path).expect(404);
        expect(ApiErrorSchema.parse(res.body).error.code).toBe(code);
      }
    });

    it('returns a subject with ordered topics and their prerequisites', async () => {
      app = await startApp(await snapshotOf(withConditions()));
      const res = await request(app.getHttpServer()).get('/api/v1/subjects/informatics').set('Accept-Language', 'en').expect(200);
      const body = SubjectDetailSchema.parse(res.body);
      expect(body.title).toBe('Informatics');
      expect(body.topics.map((t) => [t.slug, t.order, t.prerequisites])).toEqual([
        ['variables', 1, []],
        ['conditions', 2, ['variables']],
      ]);
    });

    it('returns an empty topic list for a subject without topics', async () => {
      const db = await snapshotOf(content);
      app = await startApp({ ...emptySnapshot(), subjects: db.subjects });
      const res = await request(app.getHttpServer()).get('/api/v1/subjects/informatics').expect(200);
      expect(SubjectDetailSchema.parse(res.body).topics).toEqual([]);
    });
  });

  it('serves the full six-topic subject in order with its prerequisite graph', async () => {
    app = await startApp(await snapshotOf(fullContent));
    const res = await request(app.getHttpServer()).get('/api/v1/subjects/informatics').set('Accept-Language', 'en').expect(200);
    expect(SubjectDetailSchema.parse(res.body).topics.map((t) => [t.slug, t.prerequisites])).toEqual([
      ['variables', []],
      ['conditions', ['variables']],
      ['functions', ['variables']],
      ['loops', ['conditions']],
      ['lists', ['loops']],
      ['algorithms', ['functions', 'lists']],
    ]);
  });

  describe('topics', () => {
    it('returns the topic with its subject, lessons, resources, and quiz summary', async () => {
      app = await startApp(await snapshotOf(content));
      const res = await request(app.getHttpServer()).get('/api/v1/topics/variables').set('Accept-Language', 'en').expect(200);
      const body = TopicDetailSchema.parse(res.body);
      expect(body).toMatchObject({
        slug: 'variables',
        title: 'Variables and data types',
        subject: { slug: 'informatics', title: 'Informatics', fallbackFields: [] },
        prerequisites: [],
        lessons: [{ slug: 'variables-and-data-types', title: 'Variables and basic data types', estimatedMinutes: 15, fallbackFields: [] }],
        quiz: { slug: 'variables-quiz', title: 'Quiz: variables and data types', questionCount: 4, fallbackFields: [] },
      });
      expect(body.resources.map((r) => [r.key, r.type, r.url, r.languages])).toEqual([
        ['python-crash-course', 'BOOK', null, ['en', 'ru']],
        ['automate-the-boring-stuff', 'BOOK', 'https://automatetheboringstuff.com/', ['en']],
      ]);
    });

    it('links prerequisites by slug and localized title', async () => {
      app = await startApp(await snapshotOf(withConditions()));
      const res = await request(app.getHttpServer()).get('/api/v1/topics/conditions').set('Accept-Language', 'ru').expect(200);
      expect(TopicDetailSchema.parse(res.body).prerequisites).toEqual([{ slug: 'variables', title: 'Переменные и типы данных', fallbackFields: [] }]);
    });

    it('returns quiz: null and empty arrays when the topic has no quiz, lessons, or resources', async () => {
      const db = await snapshotOf(content);
      app = await startApp({ ...emptySnapshot(), subjects: db.subjects, topics: db.topics });
      const res = await request(app.getHttpServer()).get('/api/v1/topics/variables').expect(200);
      expect(TopicDetailSchema.parse(res.body)).toMatchObject({ lessons: [], resources: [], prerequisites: [], quiz: null });
    });
  });

  describe('lessons', () => {
    it('returns the Markdown body and its topic', async () => {
      app = await startApp(await snapshotOf(content));
      const res = await request(app.getHttpServer()).get('/api/v1/lessons/variables-and-data-types').set('Accept-Language', 'tg').expect(200);
      const body = LessonDetailSchema.parse(res.body);
      expect(body.body).toBe(variablesTopic.lessons[0].body.tg.trim()); // the content schema trims text
      expect(body.topic).toEqual({ slug: 'variables', title: 'Тағйирёбандаҳо ва навъҳои додаҳо', fallbackFields: [] });
    });
  });

  describe('localization', () => {
    it.each([
      ['ru', 'ru', 'Переменные и основные типы данных'],
      ['en', 'en', 'Variables and basic data types'],
      ['en-US,en;q=0.9', 'en', 'Variables and basic data types'],
      ['ru-RU,ru;q=0.9,en;q=0.8', 'ru', 'Переменные и основные типы данных'],
      ['tg', 'tg', 'Тағйирёбандаҳо ва навъҳои асосии додаҳо'],
      ['fr', 'ru', 'Переменные и основные типы данных'],
      [undefined, 'ru', 'Переменные и основные типы данных'],
    ])('Accept-Language %j → %s', async (header, locale, title) => {
      app = await startApp(await snapshotOf(content));
      const req = request(app.getHttpServer()).get('/api/v1/lessons/variables-and-data-types');
      const res = await (header ? req.set('Accept-Language', header) : req).expect(200);
      expect(res.headers['content-language']).toBe(locale);
      expect(res.body.title).toBe(title);
    });

    it('falls back tg → ru → en and lists the fallen-back field on its own object', async () => {
      const db = await snapshotOf(content);
      const lesson = db.lessons[0];
      lesson.title = { ru: 'Только по-русски', en: 'English only' }; // no Tajik
      lesson.body = { en: 'English body only' }; // no Tajik, no Russian
      app = await startApp(db);
      const res = await request(app.getHttpServer()).get('/api/v1/lessons/variables-and-data-types').set('Accept-Language', 'tg').expect(200);
      const body = LessonDetailSchema.parse(res.body);
      expect(body).toMatchObject({ title: 'Только по-русски', body: 'English body only', fallbackFields: ['title', 'body'] });
      expect(body.topic.fallbackFields).toEqual([]);
    });
  });

  describe('missing and invalid slugs', () => {
    it.each([
      ['/api/v1/subjects/no-such-subject', 'SUBJECT_NOT_FOUND'],
      ['/api/v1/topics/no-such-topic', 'TOPIC_NOT_FOUND'],
      ['/api/v1/lessons/no-such-lesson', 'LESSON_NOT_FOUND'],
      ['/api/v1/quizzes/no-such-quiz', 'QUIZ_NOT_FOUND'],
    ])('%s → 404 %s', async (path, code) => {
      app = await startApp(await snapshotOf(content));
      const res = await request(app.getHttpServer()).get(path).expect(404);
      const error = ApiErrorSchema.parse(res.body).error;
      expect(error.code).toBe(code);
      expect(res.headers['x-request-id']).toBe(error.requestId);
    });

    it('rejects a malformed slug with 400 VALIDATION_FAILED', async () => {
      app = await startApp(await snapshotOf(content));
      const res = await request(app.getHttpServer()).get('/api/v1/topics/Not_A_Slug').expect(400);
      expect(ApiErrorSchema.parse(res.body).error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('quiz answer secrecy (FR-QUIZ-06)', () => {
    const allExplanations = variablesTopic.quiz.questions.flatMap((q) => Object.values(q.explanation));

    async function assertNoAnswers(rawJson: string) {
      expect(rawJson).not.toMatch(/"isCorrect"|"correct"|"explanation"/);
      for (const explanation of allExplanations) expect(rawJson).not.toContain(JSON.stringify(explanation).slice(1, 40));
    }

    it.each(['tg', 'ru', 'en'])('the serialized quiz (%s) contains questions and options only', async (locale) => {
      app = await startApp(await snapshotOf(content));
      const res = await request(app.getHttpServer()).get('/api/v1/quizzes/variables-quiz').set('Accept-Language', locale).expect(200);
      const quiz = PublicQuizSchema.parse(res.body); // strict schema: any extra field fails
      expect(quiz.questions.map((q) => q.key)).toEqual(['reassign', 'float-type', 'valid-name', 'string-plus']);
      for (const question of res.body.questions) {
        expect(Object.keys(question).sort()).toEqual(['fallbackFields', 'key', 'options', 'prompt', 'type']);
        for (const option of question.options) expect(Object.keys(option).sort()).toEqual(['fallbackFields', 'key', 'text']);
      }
      await assertNoAnswers(res.text);
    });

    it('stays secret even if the database layer returned answers', async () => {
      app = await startApp(await snapshotOf(content), { leakAnswers: true });
      const res = await request(app.getHttpServer()).get('/api/v1/quizzes/variables-quiz').set('Accept-Language', 'en').expect(200);
      PublicQuizSchema.parse(res.body);
      await assertNoAnswers(res.text);
    });

    it('the quiz query never selects correctness or explanations', () => {
      expect(JSON.stringify(publicQuizSelect)).not.toMatch(/isCorrect|explanation/);
    });
  });
});
