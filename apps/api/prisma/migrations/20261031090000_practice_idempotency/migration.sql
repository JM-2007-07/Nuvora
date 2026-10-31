-- Idempotent practice submissions: a client key per logical submission and a hash of the request.
-- Additive only: both columns are nullable, existing attempts keep NULL, and PostgreSQL allows
-- any number of NULLs in a unique index, so no existing row can conflict.

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "requestHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_userId_idempotencyKey_key" ON "quiz_attempts"("userId", "idempotencyKey");
