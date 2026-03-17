ALTER TABLE "events_Table" DROP CONSTRAINT "events_Table_messageId_pk";--> statement-breakpoint
-- Existing values are stored as epoch seconds (integer). Convert with to_timestamp().
ALTER TABLE "events_Table" ALTER COLUMN "scheduledTime" TYPE timestamp USING to_timestamp("scheduledTime");--> statement-breakpoint