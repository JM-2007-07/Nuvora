-- AI assistant (D-32): date of birth on accounts, daily usage counters, background jobs, teacher lessons.
-- Additive only: both new account columns have safe defaults, existing rows keep NULL and false.

-- CreateEnum
CREATE TYPE "AiJobKind" AS ENUM ('TEST', 'TOPIC');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "aiNoticePending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "birthDate" DATE;

-- CreateTable
CREATE TABLE "ai_usage" (
    "subject" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("subject","day","kind")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "kind" "AiJobKind" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "assessmentId" TEXT,
    "lessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_lessons" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" "Locale" NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_jobs_ownerKey_createdAt_idx" ON "ai_jobs"("ownerKey", "createdAt");

-- CreateIndex
CREATE INDEX "teacher_lessons_ownerKey_updatedAt_idx" ON "teacher_lessons"("ownerKey", "updatedAt");

-- CreateIndex
CREATE INDEX "teacher_lessons_groupCode_publishedAt_idx" ON "teacher_lessons"("groupCode", "publishedAt");
