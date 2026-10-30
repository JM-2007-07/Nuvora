import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AttemptRequest, AttemptResult, Locale } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadLearningState, toRecommendationDtos } from '../progress/learning-state.js';
import { masteryStatus } from '../progress/mastery.js';
import { recommend } from '../recommendations/recommend.js';
import { recordAttempt } from './record-attempt.js';
import { percent } from './scoring.js';

const storedAttemptSelect = {
  id: true,
  submittedAt: true,
  correctCount: true,
  totalCount: true,
  scorePercent: true,
  quiz: {
    select: {
      slug: true,
      title: true,
      kind: true,
      subjectId: true,
      subject: { select: { slug: true, title: true } },
      questions: {
        orderBy: [{ order: 'asc' }, { key: 'asc' }],
        select: {
          id: true,
          key: true,
          prompt: true,
          explanation: true,
          topic: { select: { slug: true, title: true } },
          options: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { id: true, key: true, text: true, isCorrect: true } },
        },
      },
    },
  },
  answers: { select: { questionId: true, selectedOptionId: true, isCorrect: true } },
} satisfies Prisma.QuizAttemptSelect;

type StoredAttempt = Prisma.QuizAttemptGetPayload<{ select: typeof storedAttemptSelect }>;

/**
 * Quiz submission (FR-QUIZ-02..05, FR-ADAPT-01..03): scores on the server from
 * stored correctness, records the attempt and answers, updates mastery for each
 * topic covered, and recommends what to review, all in one transaction.
 * The result is always built from the stored attempt, so the results page shows
 * exactly what was recorded (also for GET /me/attempts/:id).
 */
@Injectable()
export class AttemptsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  submit(quizSlug: string, learner: LearnerRecord, request: AttemptRequest, locale: Locale): Promise<AttemptResult> {
    return this.prisma.$transaction(async (tx) => {
      const { attempt } = await recordAttempt(tx, learner.id, quizSlug, request.answers);
      const stored = await tx.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id }, select: storedAttemptSelect });
      return toAttemptResult(tx, learner.id, stored, locale);
    });
  }

  /** One of the current learner's own attempts; someone else's id answers 404 like an unknown one. */
  get(attemptId: string, learner: LearnerRecord, locale: Locale): Promise<AttemptResult> {
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.quizAttempt.findFirst({ where: { id: attemptId, userId: learner.id }, select: storedAttemptSelect });
      if (!stored) throw new NotFoundException({ code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found' });
      return toAttemptResult(tx, learner.id, stored, locale);
    });
  }
}

async function toAttemptResult(tx: Prisma.TransactionClient, userId: string, stored: StoredAttempt, locale: Locale): Promise<AttemptResult> {
  const { quiz } = stored;
  const answerByQuestion = new Map(stored.answers.map((a) => [a.questionId, a]));
  const ref = (row: { slug: string; title: Prisma.JsonValue }) => {
    const { title, fallbackFields } = localizeFields(locale, { title: row.title });
    return { slug: row.slug, title, fallbackFields };
  };

  // Per-topic breakdown from the stored answers, in first-appearance order.
  const topics: { slug: string; title: Prisma.JsonValue; correctCount: number; totalCount: number }[] = [];
  const questions = quiz.questions.flatMap((q) => {
    const answer = answerByQuestion.get(q.id);
    if (!answer) return [];
    let topic = topics.find((t) => t.slug === q.topic.slug);
    if (!topic) topics.push((topic = { ...q.topic, correctCount: 0, totalCount: 0 }));
    topic.totalCount++;
    if (answer.isCorrect) topic.correctCount++;
    return [
      {
        key: q.key,
        topic: ref(q.topic),
        prompt: localizeFields(locale, { prompt: q.prompt }).prompt,
        options: q.options.map((o) => ({ key: o.key, text: localizeFields(locale, { text: o.text }).text })),
        selectedOptionKey: q.options.find((o) => o.id === answer.selectedOptionId)?.key ?? '',
        correctOptionKey: q.options.find((o) => o.isCorrect)?.key ?? '',
        isCorrect: answer.isCorrect,
        explanation: localizeFields(locale, { explanation: q.explanation }).explanation,
      },
    ];
  });
  const topicScores = topics.map((t) => ({ ...t, scorePercent: percent(t.correctCount, t.totalCount) }));

  const state = await loadLearningState(tx, userId, quiz.subjectId);
  const weak = topicScores.filter((t) => masteryStatus(t.scorePercent) === 'WEAK').map((t) => ({ slug: t.slug, scorePercent: t.scorePercent }));

  return {
    attemptId: stored.id,
    quiz: ref(quiz),
    quizKind: quiz.kind,
    subject: ref(quiz.subject),
    submittedAt: stored.submittedAt.toISOString(),
    correctCount: stored.correctCount,
    totalCount: stored.totalCount,
    scorePercent: stored.scorePercent,
    questions,
    topics: topicScores.map((t) => ({
      topic: ref(t),
      correctCount: t.correctCount,
      totalCount: t.totalCount,
      scorePercent: t.scorePercent,
      status: masteryStatus(t.scorePercent),
    })),
    recommendations: toRecommendationDtos(recommend(state.topics, weak), state, locale),
  };
}
