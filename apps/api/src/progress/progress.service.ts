import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LearnerStats, LessonCompletion, Locale, Progress } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import { type LearnerRecord, toLearner } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { recommend } from '../recommendations/recommend.js';
import { compareTopics, type TopicAttemptScore } from './comparison.js';
import { loadLearningState, toRecommendationDtos } from './learning-state.js';
import { computeStats } from './stats.js';

/** Learning Journey (FR-PROG-01..02, FR-JOUR-01) and lesson completion (FR-LES-02). */
@Injectable()
export class ProgressService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProgress(learner: LearnerRecord, subjectSlug: string, locale: Locale): Promise<Progress> {
    const subject = await this.prisma.subject.findUnique({ where: { slug: subjectSlug }, select: { id: true, slug: true, title: true, isPublished: true } });
    if (!subject || !subject.isPublished) throw new NotFoundException({ code: 'SUBJECT_NOT_FOUND', message: `Subject "${subjectSlug}" not found` });

    return this.prisma.$transaction(async (tx) => {
      const state = await loadLearningState(tx, learner.id, subject.id);
      const attempts = await tx.quizAttempt.findMany({
        where: { userId: learner.id, quiz: { subjectId: subject.id } },
        orderBy: { submittedAt: 'desc' },
        take: 20,
        select: { id: true, correctCount: true, totalCount: true, scorePercent: true, submittedAt: true, quiz: { select: { slug: true, title: true, kind: true } } },
      });
      const quizzes = await tx.quiz.findMany({
        where: { subjectId: subject.id },
        orderBy: { slug: 'asc' },
        select: { id: true, slug: true, title: true, kind: true, topic: { select: { slug: true } }, _count: { select: { questions: true } } },
      });
      // Every stored answer of this learner in this subject: the source of before/after.
      const answers = await tx.attemptAnswer.findMany({
        where: { attempt: { userId: learner.id, quiz: { subjectId: subject.id } } },
        select: {
          isCorrect: true,
          question: { select: { topic: { select: { slug: true } } } },
          attempt: { select: { id: true, submittedAt: true, quiz: { select: { slug: true, kind: true } } } },
        },
      });
      const comparison = compareTopics(
        answers.map((a) => ({
          attemptId: a.attempt.id,
          submittedAt: a.attempt.submittedAt,
          quizSlug: a.attempt.quiz.slug,
          quizKind: a.attempt.quiz.kind,
          topicSlug: a.question.topic.slug,
          isCorrect: a.isCorrect,
        })),
      );

      const ref = (row: { slug: string; title: unknown }) => ({ slug: row.slug, ...localizeFields(locale, { title: row.title }) });
      const quizBySlug = new Map(quizzes.map((q) => [q.slug, q]));
      const topicScore = (score: TopicAttemptScore | null) =>
        score && {
          attemptId: score.attemptId,
          quiz: ref(quizBySlug.get(score.quizSlug)!),
          quizKind: score.quizKind,
          correctCount: score.correctCount,
          totalCount: score.totalCount,
          scorePercent: score.scorePercent,
          submittedAt: score.submittedAt.toISOString(),
        };
      const weak = state.topics.filter((t) => t.status === 'WEAK').map((t) => ({ slug: t.slug, scorePercent: t.scorePercent ?? 0 }));

      return {
        learner: toLearner(learner),
        subject: ref(subject),
        topics: state.topics.map((t) => {
          const row = state.rows.get(t.slug)!;
          const quiz = quizzes.find((q) => q.kind === 'TOPIC' && q.topic?.slug === t.slug);
          const compared = comparison.get(t.slug);
          return {
            topic: ref(row),
            order: t.order,
            prerequisites: t.prerequisites,
            status: t.status,
            scorePercent: t.scorePercent,
            lessonCompleted: t.lessonCompleted,
            lesson: row.lessons[0] ? ref(row.lessons[0]) : null,
            quiz: quiz ? ref(quiz) : null,
            before: topicScore(compared?.before ?? null),
            after: topicScore(compared?.after ?? null),
          };
        }),
        checkpoints: quizzes
          .filter((q) => q.kind === 'CHECKPOINT')
          .map((q) => {
            const latest = attempts.find((a) => a.quiz.slug === q.slug);
            return {
              quiz: ref(q),
              questionCount: q._count.questions,
              latestAttempt: latest
                ? { id: latest.id, correctCount: latest.correctCount, totalCount: latest.totalCount, scorePercent: latest.scorePercent, submittedAt: latest.submittedAt.toISOString() }
                : null,
            };
          }),
        attempts: attempts.map((a) => ({
          id: a.id,
          quiz: ref(a.quiz),
          quizKind: a.quiz.kind,
          correctCount: a.correctCount,
          totalCount: a.totalCount,
          scorePercent: a.scorePercent,
          submittedAt: a.submittedAt.toISOString(),
        })),
        recommendations: toRecommendationDtos(recommend(state.topics, weak), state, locale),
      };
    });
  }

  /** XP, level, streak and badges for one subject, from stored attempts and lessons (rules in stats.ts). */
  async stats(learner: LearnerRecord, subjectSlug: string): Promise<LearnerStats> {
    const subject = await this.prisma.subject.findUnique({ where: { slug: subjectSlug }, select: { id: true, isPublished: true } });
    if (!subject || !subject.isPublished) throw new NotFoundException({ code: 'SUBJECT_NOT_FOUND', message: `Subject "${subjectSlug}" not found` });
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId: learner.id, quiz: { subjectId: subject.id } },
      select: { submittedAt: true, correctCount: true, quiz: { select: { kind: true } } },
    });
    const lessons = await this.prisma.lessonProgress.findMany({ where: { userId: learner.id, lesson: { topic: { subjectId: subject.id } } }, select: { completedAt: true } });
    const answers = await this.prisma.attemptAnswer.findMany({
      where: { attempt: { userId: learner.id, quiz: { subjectId: subject.id } } },
      select: { isCorrect: true, question: { select: { topic: { select: { slug: true } } } }, attempt: { select: { id: true, submittedAt: true, quiz: { select: { slug: true, kind: true } } } } },
    });
    const comparison = compareTopics(
      answers.map((a) => ({ attemptId: a.attempt.id, submittedAt: a.attempt.submittedAt, quizSlug: a.attempt.quiz.slug, quizKind: a.attempt.quiz.kind, topicSlug: a.question.topic.slug, isCorrect: a.isCorrect })),
    );
    return computeStats(
      {
        attempts: attempts.map((a) => ({ submittedAt: a.submittedAt, correctCount: a.correctCount, kind: a.quiz.kind })),
        lessons,
        comparisons: [...comparison.values()].map((c) => ({ beforePercent: c.before?.scorePercent ?? null, afterPercent: c.after?.scorePercent ?? null, afterAt: c.after?.submittedAt ?? null })),
      },
      new Date(),
    );
  }

  /** Idempotent: completing a lesson twice keeps one record. */
  async completeLesson(learner: LearnerRecord, lessonSlug: string): Promise<LessonCompletion> {
    const lesson = await this.prisma.lesson.findUnique({ where: { slug: lessonSlug }, select: { id: true, topic: { select: { subject: { select: { isPublished: true } } } } } });
    if (!lesson || !lesson.topic.subject.isPublished) throw new NotFoundException({ code: 'LESSON_NOT_FOUND', message: `Lesson "${lessonSlug}" not found` });
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: learner.id, lessonId: lesson.id } },
      create: { userId: learner.id, lessonId: lesson.id },
      update: {},
    });
    return { lesson: lessonSlug, completed: true };
  }
}
