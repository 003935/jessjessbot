-- CreateTable
CREATE TABLE "bot_memory_facts" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "people" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kind" TEXT NOT NULL DEFAULT 'fact',
    "source" TEXT NOT NULL DEFAULT 'self',
    "saidById" TEXT NOT NULL DEFAULT '',
    "saidByName" TEXT NOT NULL DEFAULT '',
    "sourceMessageId" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_memory_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_chat_windows" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL DEFAULT '',
    "userIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lines" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_chat_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_memory_facts_guildId_subjectId_idx" ON "bot_memory_facts"("guildId", "subjectId");

-- CreateIndex
CREATE INDEX "bot_chat_windows_guildId_endedAt_idx" ON "bot_chat_windows"("guildId", "endedAt");


-- Move notes jjb picked up from chat, and things friends told her, into the new table.
INSERT INTO "bot_memory_facts" ("id", "guildId", "subjectId", "text", "source", "createdAt")
SELECT gen_random_uuid()::text, "guildId", "userId", "value", 'self', "createdAt"
FROM "bot_member_preferences"
WHERE "kind" LIKE 'memory\_note\_%';

INSERT INTO "bot_memory_facts" ("id", "guildId", "subjectId", "text", "source", "saidByName", "createdAt")
SELECT gen_random_uuid()::text, "guildId", "userId",
    CASE WHEN position(' says: ' IN "value") > 0 THEN substring("value" FROM position(' says: ' IN "value") + 7) ELSE "value" END,
    'friend',
    CASE WHEN position(' says: ' IN "value") > 0 THEN substring("value" FROM 1 FOR position(' says: ' IN "value") - 1) ELSE '' END,
    "createdAt"
FROM "bot_member_preferences"
WHERE "kind" LIKE 'memory\_hearsay\_%';

DELETE FROM "bot_member_preferences" WHERE "kind" LIKE 'memory\_note\_%' OR "kind" LIKE 'memory\_hearsay\_%';
