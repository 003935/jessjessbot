-- CreateIndex
CREATE INDEX "wordle_result_messages_guildId_idx" ON "wordle_result_messages"("guildId");

-- CreateIndex
CREATE INDEX "wordle_results_discordId_idx" ON "wordle_results"("discordId");
