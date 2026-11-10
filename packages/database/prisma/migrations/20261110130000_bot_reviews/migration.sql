CREATE TABLE "bot_review_flags" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_review_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bot_review_flags_guildId_target_userId_key_key" ON "bot_review_flags"("guildId", "target", "userId", "key");

CREATE INDEX "bot_review_flags_guildId_status_idx" ON "bot_review_flags"("guildId", "status");

CREATE TABLE "bot_reviews" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "report" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bot_reviews_guildId_createdAt_idx" ON "bot_reviews"("guildId", "createdAt");
