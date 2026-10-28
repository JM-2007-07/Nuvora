import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { masteryStatus } from '../progress/mastery.js';
import { isScoringError, type ScoreResult, scoreAttempt, type SubmittedAnswer } from './scoring.js';

export const quizForScoringSelect = {
  id: true,
  slug: true,
  title: true,
  subjectId: true,
  subject: { select: { isPublished: true } },
  questions: {
    orderBy: [{ order: 'asc' }, { key: 'asc' }],
    select: {
      id: true,
      key: true,
      prompt: true,
      explanation: true,
      topic: { select: { id: true, slug: true, title: true } },
      options: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { id: true, key: true, text: true, isCorrect: true } },
    },
  },
} satisfies Prisma.QuizSelect;

export type QuizForScoring = Prisma.QuizGetPayload<{ select: typeof quizForScoringSelect }>;

export interface RecordedAttempt {
  quiz: QuizForScoring;
  score: ScoreResult;
  attempt: { id: string; submittedAt: Date };
}

/**
 * The single code path that scores and records an attempt and updates mastery
 * (ADR-0004). Used by POST /quizzes/:slug/attempts and by the demo-learner seed,
 * so seeded history follows exactly the same rules (ADR-0006). Run inside a transaction.
 */
export async function recordAttempt(
  tx: Prisma.TransactionClient,
  userId: string,
  quizSlug: string,
  answers: SubmittedAnswer[],
  submittedAt?: Date,
): Promise<RecordedAttempt> {
  const quiz = await tx.quiz.findUnique({ where: { slug: quizSlug }, select: quizForScoringSelect });
  if (!quiz || !quiz.subject.isPublished) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND', message: `Quiz "${quizSlug}" not found` });

  const score = scoreAttempt(
    quiz.questions.map((q) => ({ key: q.key, topicSlug: q.topic.slug, options: q.options })),
    answers,
  );
  if (isScoringError(score)) throw new UnprocessableEntityException({ code: score.code, message: score.message });

  const questionByKey = new Map(quiz.questions.map((q) => [q.key, q]));
  const attempt = await tx.quizAttempt.create({
    data: {
      userId,
      quizId: quiz.id,
      correctCount: score.correctCount,
      totalCount: score.totalCount,
      scorePercent: score.scorePercent,
      ...(submittedAt ? { submittedAt } : {}),
      answers: {
        create: score.questions.map((s) => {
          const q = questionByKey.get(s.key)!;
          return { questionId: q.id, selectedOptionId: q.options.find((o) => o.key === s.selectedOptionKey)!.id, isCorrect: s.isCorrect };
        }),
      },
    },
    select: { id: true, submittedAt: true },
  });

  const topicIdBySlug = new Map(quiz.questions.map((q) => [q.topic.slug, q.topic.id]));
  for (const t of score.topics) {
    const topicId = topicIdBySlug.get(t.topicSlug)!;
    const data = { scorePercent: t.scorePercent, status: masteryStatus(t.scorePercent), lastAttemptId: attempt.id };
    await tx.topicMastery.upsert({ where: { userId_topicId: { userId, topicId } }, create: { userId, topicId, ...data }, update: data });
  }
  return { quiz, score, attempt };
}
