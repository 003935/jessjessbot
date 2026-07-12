import { DatabaseConnection } from '../connection';
import type { Custom } from '../generated/prisma/client';

export type { Custom };

export class EventsTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async insert(event: {
		guildId: string;
		channelId: string;
		messageId: string;
		scheduledTime: Date;
		gameName: string;
		name?: string;
	}) {
		await this._db.custom.create({ data: event });
	}

	async getEvents(ignore_ids: number[] = []): Promise<Custom[]> {
		if (ignore_ids.length === 0) {
			return await this._db.custom.findMany();
		}
		return await this._db.custom.findMany({
			where: { id: { notIn: ignore_ids } },
		});
	}

	async getEventsByGuildIds(guild_ids: string[]): Promise<Custom[]> {
		return await this._db.custom.findMany({
			where: { guildId: { in: guild_ids } },
		});
	}

	async deleteEvents(event_ids: number[]): Promise<void> {
		await this._db.custom.deleteMany({
			where: { id: { in: event_ids } },
		});
	}
}
