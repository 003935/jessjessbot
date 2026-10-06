CREATE TABLE "bot_member_preferences" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bot_member_preferences_pkey" PRIMARY KEY ("guildId","userId","kind","value")
);

CREATE INDEX "bot_member_preferences_guildId_userId_idx" ON "bot_member_preferences"("guildId","userId");
