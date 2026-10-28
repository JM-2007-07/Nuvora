import { PrismaPg } from '@prisma/adapter-pg';
import { loadDotEnvFile, loadEnv } from '../../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { recordAttempt } from '../../quizzes/record-attempt.js';
import { DEMO_LEARNERS } from './demo-learners.js';

/**
 * pnpm db:seed:demo  (run after pnpm db:seed)
 *
 * Demo reset (ADR-0006), in one transaction:
 *   1. removes GUEST learners (their history cascades with the user: intended cleanup);
 *   2. resets each demo learner's history and replays the scripted attempts through
 *      recordAttempt(), the same scoring and mastery code as real submissions.
 * Content is never touched. Learner rows other than guests and demo learners are untouched.
 */
async function main(): Promise<number> {
  loadDotEnvFile();
  const env = loadEnv();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    const summary = await prisma.$transaction(
      async (tx) => {
        const guests = await tx.user.deleteMany({ where: { kind: 'GUEST' } });
        const lines = [`removed ${guests.count} guest learner(s)`];

        for (const script of DEMO_LEARNERS) {
          const user = await tx.user.upsert({
            where: { demoSlug: script.demoSlug },
            create: { kind: 'DEMO', demoSlug: script.demoSlug, displayName: script.displayName },
            update: { kind: 'DEMO', displayName: script.displayName },
            select: { id: true },
          });
          // Reset this demo learner's own history (answers cascade with their attempts).
          await tx.topicMastery.deleteMany({ where: { userId: user.id } });
          await tx.lessonProgress.deleteMany({ where: { userId: user.id } });
          await tx.quizAttempt.deleteMany({ where: { userId: user.id } });

          for (const slug of script.completedLessons) {
            const lesson = await tx.lesson.findUnique({ where: { slug }, select: { id: true } });
            if (!lesson) throw new Error(`Demo script: lesson "${slug}" not found. Run pnpm db:seed first.`);
            await tx.lessonProgress.create({ data: { userId: user.id, lessonId: lesson.id } });
          }

          for (const a of script.attempts) {
            const quiz = await tx.quiz.findUnique({
              where: { slug: a.quiz },
              select: { questions: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { key: true, options: { orderBy: { order: 'asc' }, select: { key: true, isCorrect: true } } } } },
            });
            if (!quiz) throw new Error(`Demo script: quiz "${a.quiz}" not found. Run pnpm db:seed first.`);
            if (quiz.questions.length !== a.correct.length) throw new Error(`Demo script: "${a.quiz}" has ${quiz.questions.length} questions, script has ${a.correct.length}`);
            const answers = quiz.questions.map((q, i) => ({
              questionKey: q.key,
              optionKey: (a.correct[i] ? q.options.find((o) => o.isCorrect) : q.options.find((o) => !o.isCorrect))!.key,
            }));
            const submittedAt = new Date(Date.now() - a.daysAgo * 24 * 60 * 60 * 1000);
            const { score } = await recordAttempt(tx, user.id, a.quiz, answers, submittedAt);
            lines.push(`${script.displayName}: ${a.quiz} ${score.correctCount}/${score.totalCount} (${score.scorePercent}%)`);
          }
        }
        return lines;
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
    console.log(['db:seed:demo:', ...summary.map((l) => `  ${l}`), 'DEMO LEARNERS RESET: all changes written in one transaction.'].join('\n'));
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
