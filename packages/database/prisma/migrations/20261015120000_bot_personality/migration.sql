ALTER TABLE "server_config"
ADD COLUMN "bot_personality" TEXT,
ADD COLUMN "bot_likes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "bot_dislikes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "bot_opinions" (
    "guildId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "opinion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bot_opinions_pkey" PRIMARY KEY ("guildId","topic")
);

CREATE INDEX "bot_opinions_guildId_updatedAt_idx" ON "bot_opinions"("guildId", "updatedAt");
