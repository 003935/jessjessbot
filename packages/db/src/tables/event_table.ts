import { type InferSelectModel, type InferInsertModel, inArray, notInArray } from 'drizzle-orm';
import { eventsTable } from '../schema';
import { db } from '../client';

export type Event = InferSelectModel<typeof eventsTable>;
type InsertEvent = InferInsertModel<typeof eventsTable>;

export class EventsTable {
  static async insert(event: InsertEvent) {
    await db.insert(eventsTable).values(event);
  }

  static async getEvents(ignore_ids: number[] = []) {
    if (ignore_ids.length === 0) {
      return await db.select().from(eventsTable);
    }
    return await db.select().from(eventsTable).where(notInArray(eventsTable.id, ignore_ids));
  }

  static async deleteEvents(event_ids: number[]) {
    await db.delete(eventsTable).where(inArray(eventsTable.id, event_ids));
  }
}
