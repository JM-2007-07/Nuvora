-- CreateEnum
CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'VOICE', 'CALL');

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "ConversationKind" NOT NULL,
    "title" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderKey" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_clips" (
    "messageId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "voice_clips_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "conversation_reads" (
    "conversationId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_reads_pkey" PRIMARY KEY ("conversationId","participantKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_key_key" ON "conversations"("key");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_reads_participantKey_idx" ON "conversation_reads"("participantKey");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_clips" ADD CONSTRAINT "voice_clips_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

