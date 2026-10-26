CREATE TABLE "bot_reply_labels" (
    "messageId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "reply" TEXT NOT NULL,
    "prompt" TEXT,
    "labeledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bot_reply_labels_pkey" PRIMARY KEY ("messageId")
);

CREATE INDEX "bot_reply_labels_guildId_createdAt_idx" ON "bot_reply_labels"("guildId", "createdAt");
