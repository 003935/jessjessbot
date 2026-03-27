import { type InferSelectModel, type InferInsertModel, inArray, notInArray, eq } from 'drizzle-orm';
import { DatabaseConnection } from '../connection';
import { eventGameTable } from '../schema';

export type EventGame = InferSelectModel<typeof eventGameTable>;
type InsertEventGame = InferInsertModel<typeof eventGameTable>;

export class EventGameTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async insert(event: InsertEventGame) {
		await this._db.insert(eventGameTable).values(event);
	}

	async update(event: InsertEventGame, old_name: string) {
		await this._db.update(eventGameTable).set(event).where(eq(eventGameTable.name, old_name));
	}

	async deleteEvent(event_name: string) {
		await this._db.delete(eventGameTable).where(eq(eventGameTable.name, event_name));
	}

	async exists(event_name: string) {
		const result = await this._db
			.select({ name: eventGameTable.name })
			.from(eventGameTable)
			.where(eq(eventGameTable.name, event_name))
			.limit(1);
		return result.length > 0;
	}
}
