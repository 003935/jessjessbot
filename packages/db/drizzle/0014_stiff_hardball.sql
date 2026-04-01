TRUNCATE "winners_Table";
--> statement-breakpoint
CREATE TYPE "public"."score" AS ENUM('1', '2', '3', '4', '5', '6', 'DNF');
--> statement-breakpoint
ALTER TABLE "winners_Table" DROP CONSTRAINT "winners_Table_discordId_messageId_pk";
--> statement-breakpoint
ALTER TABLE "winners_Table" ADD COLUMN "message_timestamp" timestamp NOT NULL;
--> statement-breakpoint
ALTER TABLE "winners_Table" ADD COLUMN "channelId" varchar(20) NOT NULL;
--> statement-breakpoint
ALTER TABLE "winners_Table" ADD COLUMN "score" "score" NOT NULL;
--> statement-breakpoint
ALTER TABLE "winners_Table" ADD COLUMN "winner" boolean NOT NULL;
--> statement-breakpoint
ALTER TABLE "winners_Table" ADD CONSTRAINT "winners_Table_discordId_channelId_messageId_pk" PRIMARY KEY("discordId","channelId","messageId");
