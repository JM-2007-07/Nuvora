-- Teacher assessments taken by learners in Standard Exam Mode: attempts, answers, exam timeline,
-- and the per-assessment violation policy. Additive only: existing rows get the defaults.

-- CreateEnum
CREATE TYPE "ExamViolationAction" AS ENUM ('FLAG', 'PAUSE', 'END');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'EXPIRED', 'ENDED');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "examAction" "ExamViolationAction" NOT NULL DEFAULT 'FLAG',
ADD COLUMN     "examActionAfter" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "examAllowReentry" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "examNotifyAfter" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "examWarnAfter" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "questionOrder" JSONB NOT NULL,
    "optionOrder" JSONB NOT NULL,
    "correctCount" INTEGER,
    "totalCount" INTEGER NOT NULL,
    "scorePercent" INTEGER,
    "violations" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "reentries" INTEGER NOT NULL DEFAULT 0,
    "readmitOpen" BOOLEAN NOT NULL DEFAULT false,
    "notice" TEXT,
    "resetAt" TIMESTAMP(3),

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answers" (
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionKey" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCorrect" BOOLEAN,

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("attemptId","questionId")
);

-- CreateTable
CREATE TABLE "exam_events" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "actorKey" TEXT,
    "clientAt" TEXT,
    "meta" JSONB,

    CONSTRAINT "exam_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_attempts_assessmentId_idx" ON "assessment_attempts"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_attempts_userId_idx" ON "assessment_attempts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_assessmentId_userId_attemptNo_key" ON "assessment_attempts"("assessmentId", "userId", "attemptNo");

-- CreateIndex
CREATE INDEX "exam_events_attemptId_at_idx" ON "exam_events"("attemptId", "at");

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assessment_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_events" ADD CONSTRAINT "exam_events_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exam timeline rows are never changed: the database refuses UPDATE.
CREATE FUNCTION "exam_events_no_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'exam_events rows cannot be changed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "exam_events_no_update"
BEFORE UPDATE ON "exam_events"
FOR EACH ROW EXECUTE FUNCTION "exam_events_no_update"();
