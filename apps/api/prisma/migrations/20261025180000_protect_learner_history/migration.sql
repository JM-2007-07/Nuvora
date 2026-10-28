-- Deletion policy (docs/04-data/data-model.md#deletion-policy): content that learners have
-- history for cannot be deleted. Replaces CASCADE / SET NULL with RESTRICT on the five
-- foreign keys from learner-history tables to content. User deletion still cascades.
-- Generated offline with `prisma migrate diff --from-schema <applied schema> --to-schema`.

-- DropForeignKey
ALTER TABLE "quiz_attempts" DROP CONSTRAINT "quiz_attempts_quizId_fkey";

-- DropForeignKey
ALTER TABLE "attempt_answers" DROP CONSTRAINT "attempt_answers_questionId_fkey";

-- DropForeignKey
ALTER TABLE "attempt_answers" DROP CONSTRAINT "attempt_answers_selectedOptionId_fkey";

-- DropForeignKey
ALTER TABLE "topic_masteries" DROP CONSTRAINT "topic_masteries_topicId_fkey";

-- DropForeignKey
ALTER TABLE "lesson_progress" DROP CONSTRAINT "lesson_progress_lessonId_fkey";

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "answer_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_masteries" ADD CONSTRAINT "topic_masteries_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

