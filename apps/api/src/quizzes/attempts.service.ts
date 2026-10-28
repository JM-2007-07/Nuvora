import { Inject, Injectable } from '@nestjs/common';
import type { AttemptRequest, AttemptResult, Locale } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadLearningState, toRecommendationDtos } from '../progress/learning-state.js';
import { masteryStatus } from '../progress/mastery.js';
import { recommend } from '../recommendations/recommend.js';
import { recordAttempt } from './record-attempt.js';

/**
 * Quiz submission (FR-QUIZ-02..05, FR-ADAPT-01..03): scores on the server from
 * stored correctness, records the attempt and answers, updates mastery for each
 * topic covered, and recommends what to review, all in one transaction.
 */
@Injectable()
export class AttemptsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  submit(quizSlug: string, learner: LearnerRecord, request: AttemptRequest, locale: Locale): Promise<AttemptResult> {
    return this.prisma.$transaction(async (tx) => {
      const { quiz, score, attempt } = await recordAttempt(tx, learner.id, quizSlug, request.answers);
      const state = await loadLearningState(tx, learner.id, quiz.subjectId);
      const weak = score.topics.filter((t) => masteryStatus(t.scorePercent) === 'WEAK').map((t) => ({ slug: t.topicSlug, scorePercent: t.scorePercent }));
      const questionByKey = new Map(quiz.questions.map((q) => [q.key, q]));
      const topicBySlug = new Map(quiz.questions.map((q) => [q.topic.slug, q.topic]));

      return {
        attemptId: attempt.id,
        quiz: { slug: quiz.slug, ...localizeFields(locale, { title: quiz.title }) },
        submittedAt: attempt.submittedAt.toISOString(),
        correctCount: score.correctCount,
        totalCount: score.totalCount,
        scorePercent: score.scorePercent,
        questions: score.questions.map((s) => {
          const q = questionByKey.get(s.key)!;
          return {
            key: s.key,
            prompt: localizeFields(locale, { prompt: q.prompt }).prompt,
            options: q.options.map((o) => ({ key: o.key, text: localizeFields(locale, { text: o.text }).text })),
            selectedOptionKey: s.selectedOptionKey,
            correctOptionKey: s.correctOptionKey,
            isCorrect: s.isCorrect,
            explanation: localizeFields(locale, { explanation: q.explanation }).explanation,
          };
        }),
        topics: score.topics.map((t) => {
          const topic = topicBySlug.get(t.topicSlug)!;
          const { title, fallbackFields } = localizeFields(locale, { title: topic.title });
          return {
            topic: { slug: topic.slug, title, fallbackFields },
            correctCount: t.correctCount,
            totalCount: t.totalCount,
            scorePercent: t.scorePercent,
            status: masteryStatus(t.scorePercent),
          };
        }),
        recommendations: toRecommendationDtos(recommend(state.topics, weak), state, locale),
      };
    });
  }
}
