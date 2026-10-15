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
		teamCount?: number;
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

	async getByMessage(guildId: string, messageId: string) {
		return await this._db.custom.findFirst({ where: { guildId, messageId } });
	}

	async setSignup(eventId: number, userId: string, status: 'JOINED' | 'MAYBE' | 'LEFT') {
		return await this._db.customSignup.upsert({
			where: { eventId_userId: { eventId, userId } },
			create: { eventId, userId, status },
			update: { status },
		});
	}

	async removeSignup(eventId: number, userId: string) {
		return await this.setSignup(eventId, userId, 'LEFT');
	}

	async getSignups(eventId: number) {
		return await this._db.customSignup.findMany({ where: { eventId } });
	}

	async getSignupCounts(eventId: number) {
		return await this._db.customSignup.groupBy({
			by: ['status'],
			where: { eventId },
			_count: { _all: true },
		});
	}

	async deleteEvents(event_ids: number[]): Promise<void> {
		await this._db.custom.deleteMany({
			where: { id: { in: event_ids } },
		});
	}
}
