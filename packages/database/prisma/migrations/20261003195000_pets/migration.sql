CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pet_photos" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pet_photos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pets_guildId_ownerId_nameKey_key" ON "pets"("guildId", "ownerId", "nameKey");
CREATE INDEX "pets_guildId_ownerId_idx" ON "pets"("guildId", "ownerId");
CREATE UNIQUE INDEX "pet_photos_fileId_key" ON "pet_photos"("fileId");
CREATE UNIQUE INDEX "pet_photos_petId_sourceMessageId_key" ON "pet_photos"("petId", "sourceMessageId");
ALTER TABLE "pet_photos" ADD CONSTRAINT "pet_photos_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
