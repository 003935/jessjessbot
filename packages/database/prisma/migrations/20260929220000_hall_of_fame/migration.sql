CREATE TABLE "hall_channels" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "newestSeen" TEXT,
    "oldestBefore" TEXT,
    "backfillComplete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hall_channels_pkey" PRIMARY KEY ("guildId", "channelId")
);

CREATE TABLE "hall_messages" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "reactions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hall_messages_pkey" PRIMARY KEY ("channelId", "messageId")
);

CREATE TABLE "hall_imports" (
    "guildId" TEXT NOT NULL,
    "lastImport" TIMESTAMP(3) NOT NULL,
    "importedBy" TEXT NOT NULL,
    "messagesScanned" INTEGER NOT NULL,
    "messagesImported" INTEGER NOT NULL,

    CONSTRAINT "hall_imports_pkey" PRIMARY KEY ("guildId")
);

CREATE INDEX "hall_channels_guildId_enabled_idx" ON "hall_channels"("guildId", "enabled");
CREATE INDEX "hall_messages_guildId_reactions_idx" ON "hall_messages"("guildId", "reactions");
CREATE INDEX "hall_messages_guildId_authorId_reactions_idx" ON "hall_messages"("guildId", "authorId", "reactions");
