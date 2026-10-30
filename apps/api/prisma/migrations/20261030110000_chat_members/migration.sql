-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "createdByKey" TEXT;

-- AlterTable
ALTER TABLE "conversation_reads" ADD COLUMN     "clearedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "conversation_members" (
    "conversationId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "changedByKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversationId","participantKey")
);

-- CreateIndex
CREATE INDEX "conversation_members_participantKey_idx" ON "conversation_members"("participantKey");

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

