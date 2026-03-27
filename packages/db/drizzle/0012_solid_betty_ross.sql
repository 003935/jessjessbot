ALTER TABLE "events_Table" DROP CONSTRAINT "events_Table_gameName_event_Game_Table_name_fk";
--> statement-breakpoint
ALTER TABLE "game_Role_Table" DROP CONSTRAINT "game_Role_Table_gameName_event_Game_Table_name_fk";
--> statement-breakpoint
ALTER TABLE "events_Table" ADD CONSTRAINT "events_Table_gameName_event_Game_Table_name_fk" FOREIGN KEY ("gameName") REFERENCES "public"."event_Game_Table"("name") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "game_Role_Table" ADD CONSTRAINT "game_Role_Table_gameName_event_Game_Table_name_fk" FOREIGN KEY ("gameName") REFERENCES "public"."event_Game_Table"("name") ON DELETE cascade ON UPDATE cascade;