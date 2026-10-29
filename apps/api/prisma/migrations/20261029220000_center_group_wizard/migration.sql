-- AlterTable
ALTER TABLE "study_groups" ADD COLUMN     "displayCode" TEXT,
ADD COLUMN     "languages" "Locale"[],
ADD COLUMN     "startsOn" TIMESTAMP(3),
ADD COLUMN     "teacherKey" TEXT,
ADD COLUMN     "teacherName" TEXT;

-- CreateIndex
CREATE INDEX "study_groups_teacherKey_idx" ON "study_groups"("teacherKey");

-- CreateIndex
CREATE UNIQUE INDEX "study_groups_organizationId_displayCode_key" ON "study_groups"("organizationId", "displayCode");
