import { DatabaseConnection } from '../connection';
import type { CustomGame } from '../generated/prisma/client';

export type { CustomGame as Game };

export class GamesTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async getAll(): Promise<CustomGame[]> {
		return await this._db.customGame.findMany();
	}

	async get(gameName: string): Promise<CustomGame | null> {
		return await this._db.customGame.findUnique({ where: { name: gameName } });
	}

	async insert(event: { name: string; icon?: string | null }): Promise<void> {
		await this._db.customGame.create({ data: event });
	}

	async update(old_name: string, event: { name: string; icon?: string | null }): Promise<void> {
		await this._db.customGame.update({
			where: { name: old_name },
			data: event,
		});
	}

	async deleteGame(game_name: string): Promise<void> {
		await this._db.customGame.delete({
			where: { name: game_name },
		});
	}

	async exists(game_name: string): Promise<boolean> {
		const result = await this._db.customGame.findUnique({
			where: { name: game_name },
			select: { name: true },
		});
		return result !== null;
	}
}
