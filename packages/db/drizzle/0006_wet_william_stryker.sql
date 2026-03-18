CREATE TABLE "events_Games_Table" (
	"guildId" varchar(20) NOT NULL,
	"name" text NOT NULL,
	"roleId" varchar(20) NOT NULL,
	CONSTRAINT "events_Games_Table_guildId_roleId_pk" PRIMARY KEY("guildId","roleId")
);
