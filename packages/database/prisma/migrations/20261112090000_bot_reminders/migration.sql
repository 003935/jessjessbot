-- CreateTable
CREATE TABLE "bot_reminders" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_reminders_sentAt_remindAt_idx" ON "bot_reminders"("sentAt", "remindAt");

-- CreateIndex
CREATE INDEX "bot_reminders_guildId_sentAt_idx" ON "bot_reminders"("guildId", "sentAt");
