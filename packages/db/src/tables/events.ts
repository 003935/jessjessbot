import { type InferSelectModel, type InferInsertModel, inArray, notInArray } from 'drizzle-orm';
import { DatabaseConnection } from '../connection';
import { eventsTable } from '../schema';

export type Event = InferSelectModel<typeof eventsTable>;
type InsertEvent = InferInsertModel<typeof eventsTable>;

export class EventsTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async insert(event: InsertEvent) {
		await this._db.insert(eventsTable).values(event);
	}

	async getEvents(ignore_ids: number[] = []) {
		if (ignore_ids.length === 0) {
			return await this._db.select().from(eventsTable);
		}
		return await this._db.select().from(eventsTable).where(notInArray(eventsTable.id, ignore_ids));
	}

	async getEventsByGuildIds(guild_ids: string[]) {
		return await this._db.select().from(eventsTable).where(inArray(eventsTable.guildId, guild_ids));
	}

	async deleteEvents(event_ids: number[]) {
		await this._db.delete(eventsTable).where(inArray(eventsTable.id, event_ids));
	}
}
