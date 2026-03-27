ALTER TABLE "league_Table" DROP CONSTRAINT "league_Table_discordId_riot_puuid_pk";--> statement-breakpoint
ALTER TABLE "league_Table" ADD PRIMARY KEY ("riot_puuid");