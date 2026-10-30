-- CreateEnum
CREATE TYPE "AssessmentPurpose" AS ENUM ('CHECK', 'RETEST', 'DIAGNOSTIC');

-- CreateEnum
CREATE TYPE "AnswerReveal" AS ENUM ('AFTER_CLOSE', 'AFTER_SUBMIT', 'NEVER');

-- CreateEnum
CREATE TYPE "AssessmentAudience" AS ENUM ('CLASS', 'UNDER_60');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "subjectSlug" TEXT NOT NULL,
    "topicSlug" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "purpose" "AssessmentPurpose" NOT NULL,
    "languages" "Locale"[],
    "audience" "AssessmentAudience" NOT NULL DEFAULT 'CLASS',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "timeLimitMinutes" INTEGER,
    "attemptsAllowed" INTEGER NOT NULL DEFAULT 1,
    "revealAnswers" "AnswerReveal" NOT NULL DEFAULT 'AFTER_CLOSE',
    "xp" INTEGER NOT NULL DEFAULT 40,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "notifyStudents" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "topicSlug" TEXT NOT NULL,
    "sourceQuiz" TEXT,
    "sourceKey" TEXT,
    "prompt" JSONB NOT NULL,
    "code" TEXT,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_ownerKey_idx" ON "assessments"("ownerKey");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_questions_assessmentId_order_key" ON "assessment_questions"("assessmentId", "order");

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
