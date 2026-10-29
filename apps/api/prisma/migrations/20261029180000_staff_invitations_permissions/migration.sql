-- CreateTable
CREATE TABLE "staff_invitations" (
    "id" TEXT NOT NULL,
    "orgKey" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "subject" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "invitedByKey" TEXT NOT NULL,
    "invitedByName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedAccountId" TEXT,
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "center_permissions" (
    "orgKey" TEXT NOT NULL,
    "coordGroups" BOOLEAN NOT NULL DEFAULT true,
    "coordStaff" BOOLEAN NOT NULL DEFAULT true,
    "teachCreate" BOOLEAN NOT NULL DEFAULT true,
    "teachShare" BOOLEAN NOT NULL DEFAULT false,
    "updatedByKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "center_permissions_pkey" PRIMARY KEY ("orgKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitations_tokenHash_key" ON "staff_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "staff_invitations_orgKey_idx" ON "staff_invitations"("orgKey");

-- CreateIndex
CREATE INDEX "staff_invitations_acceptedAccountId_idx" ON "staff_invitations"("acceptedAccountId");

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_acceptedAccountId_fkey" FOREIGN KEY ("acceptedAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
