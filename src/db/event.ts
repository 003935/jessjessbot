import { InferSelectModel, eq, desc, InferInsertModel, gte, lt, inArray } from "drizzle-orm";
import { eventsTable } from "./schema";
import { db } from ".";

export type Event = InferSelectModel<typeof eventsTable>;
type InsertEvent = InferInsertModel<typeof eventsTable>;

export class EventsTable {
    static async insert(event: InsertEvent) {
        await db.insert(eventsTable).values(event);
    }

    static async getFutureEvents() {
        return await db.select().from(eventsTable).where(gte(eventsTable.scheduledTime, new Date()));
    }

    static async getPastEvents() {
        return await db.select().from(eventsTable).where(lt(eventsTable.scheduledTime, new Date()));
    }

    static async deleteEvents(event_ids: number[]) {
        await db.delete(eventsTable).where(inArray(eventsTable.id, event_ids))
    }
}

