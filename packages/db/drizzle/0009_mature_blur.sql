CREATE TABLE "event_Game_Table" (
	"name" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events_Games_Table" RENAME TO "game_Role_Table";--> statement-breakpoint
ALTER TABLE "game_Role_Table" RENAME COLUMN "name" TO "gameName";--> statement-breakpoint
ALTER TABLE "events_Table" RENAME COLUMN "game" TO "gameName";--> statement-breakpoint
ALTER TABLE "game_Role_Table" DROP CONSTRAINT "events_Games_Table_guildId_roleId_pk";--> statement-breakpoint
ALTER TABLE "game_Role_Table" ADD CONSTRAINT "game_Role_Table_guildId_gameName_roleId_pk" PRIMARY KEY("guildId","gameName","roleId");--> statement-breakpoint
INSERT INTO "event_Game_Table" ("name") SELECT DISTINCT "gameName" FROM "game_Role_Table" ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "event_Game_Table" ("name") SELECT DISTINCT "gameName" FROM "events_Table" ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "game_Role_Table" ADD CONSTRAINT "game_Role_Table_gameName_event_Game_Table_name_fk" FOREIGN KEY ("gameName") REFERENCES "public"."event_Game_Table"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events_Table" ADD CONSTRAINT "events_Table_gameName_event_Game_Table_name_fk" FOREIGN KEY ("gameName") REFERENCES "public"."event_Game_Table"("name") ON DELETE no action ON UPDATE no action;