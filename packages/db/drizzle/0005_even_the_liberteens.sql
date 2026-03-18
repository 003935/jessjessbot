ALTER TABLE "events_Table" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "events_Table" ADD COLUMN "guildId" varchar(20) NOT NULL;