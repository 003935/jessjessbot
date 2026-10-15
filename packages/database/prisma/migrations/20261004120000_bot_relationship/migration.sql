CREATE TABLE "bot_relationships" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bot_relationships_pkey" PRIMARY KEY ("guildId","userId")
);
