import { type InferSelectModel, type InferInsertModel, eq } from 'drizzle-orm';
import { DatabaseConnection } from '../connection';
import { eventGameTable } from '../schema';

export type Game = InferSelectModel<typeof eventGameTable>;
type InsertGame = InferInsertModel<typeof eventGameTable>;

export class GamesTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async getAll() {
		return await this._db.select().from(eventGameTable);
	}

	async insert(event: InsertGame) {
		await this._db.insert(eventGameTable).values(event);
	}

	async update(old_name: string, event: InsertGame) {
		await this._db.update(eventGameTable).set(event).where(eq(eventGameTable.name, old_name));
	}

	async deleteGame(game_name: string) {
		await this._db.delete(eventGameTable).where(eq(eventGameTable.name, game_name));
	}

	async exists(game_name: string) {
		const result = await this._db
			.select({ name: eventGameTable.name })
			.from(eventGameTable)
			.where(eq(eventGameTable.name, game_name))
			.limit(1);
		return result.length > 0;
	}
}
