import { InferSelectModel, eq, desc, InferInsertModel, gt } from "drizzle-orm";
import { eventsTable } from "./schema";
import { db } from ".";

type Event = InferSelectModel<typeof eventsTable>;
type InsertEvent = InferInsertModel<typeof eventsTable>;

export class EventsTable {
    static async insert(event: InsertEvent) {
        await db.insert(eventsTable).values(event);
    }
        static async getFutureEvents() {
        const now = Math.floor(Date.now() / 1000);
        return await db.select().from(eventsTable).where(gt(eventsTable.scheduledTime, now));
    }

    static async delete(messageId: string) {
        await db.delete(eventsTable).where(eq(eventsTable.messageId, messageId));
    }

}

