CREATE TYPE "public"."region" AS ENUM('BR1', 'EUN1', 'EUW1', 'KR', 'LA1', 'LA2', 'NA1', 'OC1', 'TR1', 'RU', 'JP1', 'VN2', 'TW2', 'SG2', 'ME1', 'PBE1');--> statement-breakpoint
CREATE TABLE "events_Table" (
	"channelId" varchar(20) NOT NULL,
	"messageId" varchar(20) NOT NULL,
	"scheduledTime" integer NOT NULL,
	CONSTRAINT "events_Table_messageId_pk" PRIMARY KEY("messageId")
);
--> statement-breakpoint
CREATE TABLE "league_Table" (
	"discordId" varchar(20) NOT NULL,
	"riot_puuid" varchar(78) NOT NULL,
	"riot_gamename" text,
	"riot_tagline" text,
	"region" "region",
	"leaguedata" jsonb,
	"tftdata" jsonb,
	CONSTRAINT "league_Table_discordId_riot_puuid_pk" PRIMARY KEY("discordId","riot_puuid")
);
--> statement-breakpoint
CREATE TABLE "winners_Table" (
	"discordId" varchar(20) NOT NULL,
	"messageId" varchar(20) NOT NULL,
	CONSTRAINT "winners_Table_discordId_messageId_pk" PRIMARY KEY("discordId","messageId")
);
