import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { LessonCompletion, Locale, Progress } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import { type LearnerRecord, toLearner } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { recommend } from '../recommendations/recommend.js';
import { loadLearningState, toRecommendationDtos } from './learning-state.js';

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
        select: { id: true, scorePercent: true, submittedAt: true, quiz: { select: { slug: true, title: true } } },
      });
      const weak = state.topics.filter((t) => t.status === 'WEAK').map((t) => ({ slug: t.slug, scorePercent: t.scorePercent ?? 0 }));
      return {
        learner: toLearner(learner),
        subject: { slug: subject.slug, ...localizeFields(locale, { title: subject.title }) },
        topics: state.topics.map((t) => ({
          topic: { slug: t.slug, ...localizeFields(locale, { title: state.rows.get(t.slug)!.title }) },
          order: t.order,
          prerequisites: t.prerequisites,
          status: t.status,
          scorePercent: t.scorePercent,
          lessonCompleted: t.lessonCompleted,
        })),
        attempts: attempts.map((a) => ({
          id: a.id,
          quiz: { slug: a.quiz.slug, ...localizeFields(locale, { title: a.quiz.title }) },
          scorePercent: a.scorePercent,
          submittedAt: a.submittedAt.toISOString(),
        })),
        recommendations: toRecommendationDtos(recommend(state.topics, weak), state, locale),
      };
    });
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
