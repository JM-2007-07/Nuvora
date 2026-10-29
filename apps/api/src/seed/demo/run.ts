import { PrismaPg } from '@prisma/adapter-pg';
import { bankDraft, defaultSchedule, questionData } from '../../assessments/assessment-rules.js';
import { loadDotEnvFile, loadEnv } from '../../config/env.js';
import { DEMO_CENTER_KEY } from '../../invitations/invitation-rules.js';
import { DEMO_CENTER_ORG_ID, DEMO_UNASSIGNED_STUDENTS } from '../../staff/demo-org.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { recordAttempt } from '../../quizzes/record-attempt.js';
import { answersFromChoices, B12_DIAGNOSTIC_QUIZ, B12_GROUP, B12_RETEST_QUIZ, B12_STUDENTS } from './b12-cohort.js';
import { DEMO_TEACHER, FUNCTIONS_CHECK, FUNCTIONS_CHECK_NEW_QUESTIONS } from './demo-assessments.js';
import { DEMO_LEARNERS } from './demo-learners.js';

/**
 * pnpm db:seed:demo  (run after pnpm db:seed)
 *
 * Demo reset (ADR-0006), in one transaction:
 *   1. removes GUEST learners (their history cascades with the user: intended cleanup);
 *   2. resets each demo learner's history and replays the scripted attempts through
 *      recordAttempt(), the same scoring and mastery code as real submissions.
 *   3. resets group B-12 (Faroz handoff) and replays its JavaScript diagnostic and
 *      Arrays retest answers through the same recordAttempt().
 *   4. removes teacher Dilshod's assessments and recreates the design's Functions draft.
 *   5. removes the demo center's invitations and resets its permissions (no row = handoff defaults).
 *   6. group wizard: upserts the demo center's organization row, removes its wizard groups,
 *      and creates the design's unassigned students as demo learners without history.
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

        /** Creates or renames a demo learner and clears their own history (answers cascade with attempts). */
        const resetDemoLearner = async (demoSlug: string, displayName: string) => {
          const user = await tx.user.upsert({
            where: { demoSlug },
            create: { kind: 'DEMO', demoSlug, displayName },
            update: { kind: 'DEMO', displayName },
            select: { id: true },
          });
          await tx.topicMastery.deleteMany({ where: { userId: user.id } });
          await tx.lessonProgress.deleteMany({ where: { userId: user.id } });
          await tx.quizAttempt.deleteMany({ where: { userId: user.id } });
          return user;
        };
        const questionKeys = async (quizSlug: string) => {
          const quiz = await tx.quiz.findUnique({
            where: { slug: quizSlug },
            select: { questions: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { key: true, options: { orderBy: { order: 'asc' }, select: { key: true, isCorrect: true } } } } },
          });
          if (!quiz) throw new Error(`Demo script: quiz "${quizSlug}" not found. Run pnpm db:seed first.`);
          return quiz.questions;
        };

        for (const script of DEMO_LEARNERS) {
          const user = await resetDemoLearner(script.demoSlug, script.displayName);

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

        // Group B-12: every student is a demo learner; history replayed from the handoff answers.
        for (const [index, student] of B12_STUDENTS.entries()) {
          const user = await resetDemoLearner(student.slug, student.name);
          if (student.diagnostic) {
            const keys = await questionKeys(B12_DIAGNOSTIC_QUIZ);
            const at = new Date(`${B12_GROUP.diagnosticOn}T09:00:00Z`);
            at.setUTCMinutes(index);
            const { score } = await recordAttempt(tx, user.id, B12_DIAGNOSTIC_QUIZ, answersFromChoices(keys.map((k) => k.key), student.diagnostic), at);
            lines.push(`${student.name}: diagnostic ${score.correctCount}/${score.totalCount}`);
          }
          if (student.retest) {
            const keys = await questionKeys(B12_RETEST_QUIZ);
            const answers = keys.map((q, i) => ({ questionKey: q.key, optionKey: q.options.find((o) => o.isCorrect === (student.retest![i] === '1'))!.key }));
            const at = new Date(`${B12_GROUP.retestOn}T10:00:00Z`);
            at.setUTCMinutes(index);
            const { score } = await recordAttempt(tx, user.id, B12_RETEST_QUIZ, answers, at);
            lines.push(`${student.name}: Arrays retest ${score.correctCount}/${score.totalCount}`);
          }
        }
        // Teacher Dilshod's assessments: removed and the design's Functions draft recreated.
        const removed = await tx.assessment.deleteMany({ where: { ownerKey: DEMO_TEACHER } });
        const bankQuiz = await tx.quiz.findUnique({
          where: { slug: FUNCTIONS_CHECK.bank.quiz },
          select: {
            questions: {
              where: { key: { in: [...FUNCTIONS_CHECK.bank.keys] } },
              select: { key: true, prompt: true, explanation: true, topic: { select: { slug: true } }, options: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { text: true, isCorrect: true } } },
            },
          },
        });
        const bank = FUNCTIONS_CHECK.bank.keys.map((key) => {
          const q = bankQuiz?.questions.find((x) => x.key === key);
          if (!q) throw new Error(`Demo script: question "${key}" of "${FUNCTIONS_CHECK.bank.quiz}" not found. Run pnpm db:seed first.`);
          return bankDraft(q, FUNCTIONS_CHECK.bank.quiz);
        });
        const schedule = defaultSchedule(new Date());
        await tx.assessment.create({
          data: {
            ownerKey: DEMO_TEACHER,
            groupCode: FUNCTIONS_CHECK.groupCode,
            subjectSlug: FUNCTIONS_CHECK.subjectSlug,
            topicSlug: FUNCTIONS_CHECK.topicSlug,
            title: FUNCTIONS_CHECK.title,
            description: FUNCTIONS_CHECK.description,
            purpose: FUNCTIONS_CHECK.purpose,
            languages: ['en', 'ru', 'tg'],
            opensAt: schedule.opensAt,
            closesAt: schedule.closesAt,
            questions: { create: [...bank, ...FUNCTIONS_CHECK_NEW_QUESTIONS].map(questionData) },
          },
        });
        lines.push(`teacher ${DEMO_TEACHER}: removed ${removed.count} assessment(s), recreated draft "${FUNCTIONS_CHECK.title}" (5 questions)`);

        // Faroz Demo Center: invitations made in the demo are removed; permissions back to the handoff defaults.
        const invitations = await tx.staffInvitation.deleteMany({ where: { orgKey: DEMO_CENTER_KEY } });
        await tx.centerPermissions.deleteMany({ where: { orgKey: DEMO_CENTER_KEY } });
        lines.push(`demo center: removed ${invitations.count} invitation(s), permissions reset to the handoff defaults`);

        // Group wizard: the demo center as an organization row, its wizard groups removed
        // (members cascade), and the design's unassigned students ready to enroll.
        await tx.organization.upsert({ where: { id: DEMO_CENTER_ORG_ID }, create: { id: DEMO_CENTER_ORG_ID, name: 'Faroz Demo Center' }, update: { name: 'Faroz Demo Center' } });
        const wizardGroups = await tx.studyGroup.deleteMany({ where: { organizationId: DEMO_CENTER_ORG_ID } });
        for (const s of DEMO_UNASSIGNED_STUDENTS) await resetDemoLearner(s.slug, s.name);
        lines.push(`demo center: removed ${wizardGroups.count} wizard group(s); ${DEMO_UNASSIGNED_STUDENTS.length} unassigned students ready`);
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
