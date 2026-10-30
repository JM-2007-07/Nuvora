-- CreateTable
CREATE TABLE "profiles" (
    "participantKey" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "languages" "Locale"[],
    "interests" TEXT[],
    "links" JSONB NOT NULL DEFAULT '[]',
    "subject" TEXT NOT NULL DEFAULT '',
    "experienceYears" INTEGER,
    "officeHours" TEXT NOT NULL DEFAULT '',
    "cover" TEXT NOT NULL DEFAULT 'aurora',
    "accent" TEXT NOT NULL DEFAULT 'mint',
    "visibility" JSONB NOT NULL,
    "showOnline" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("participantKey")
);

-- CreateTable
CREATE TABLE "profile_avatars" (
    "participantKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_avatars_pkey" PRIMARY KEY ("participantKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_handle_key" ON "profiles"("handle");

-- AddForeignKey
ALTER TABLE "profile_avatars" ADD CONSTRAINT "profile_avatars_participantKey_fkey" FOREIGN KEY ("participantKey") REFERENCES "profiles"("participantKey") ON DELETE CASCADE ON UPDATE CASCADE;

