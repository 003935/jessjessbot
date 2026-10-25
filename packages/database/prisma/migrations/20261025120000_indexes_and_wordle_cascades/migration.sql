-- DropForeignKey
ALTER TABLE "wordle_results" DROP CONSTRAINT "wordle_results_channelId_messageId_fkey";

-- DropForeignKey
ALTER TABLE "failed_mentions" DROP CONSTRAINT "failed_mentions_channelId_messageId_fkey";

-- CreateIndex
CREATE INDEX "customs_guildId_messageId_idx" ON "customs"("guildId", "messageId");

-- CreateIndex
CREATE INDEX "league_accounts_discordId_idx" ON "league_accounts"("discordId");

-- AddForeignKey
ALTER TABLE "wordle_results" ADD CONSTRAINT "wordle_results_channelId_messageId_fkey" FOREIGN KEY ("channelId", "messageId") REFERENCES "wordle_result_messages"("channelId", "messageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_mentions" ADD CONSTRAINT "failed_mentions_channelId_messageId_fkey" FOREIGN KEY ("channelId", "messageId") REFERENCES "wordle_result_messages"("channelId", "messageId") ON DELETE CASCADE ON UPDATE CASCADE;
