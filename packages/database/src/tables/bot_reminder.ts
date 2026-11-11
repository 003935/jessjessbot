import { DatabaseConnection } from '../connection';

/** How many reminders one member can have waiting in a server. */
export const MAX_OPEN_REMINDERS = 5;

export type Reminder = {
	id: number;
	guildId: string;
	channelId: string;
	userId: string;
	userName: string;
	text: string;
	remindAt: Date;
};

export type NewReminder = Omit<Reminder, 'id'>;

export class BotReminderTable extends DatabaseConnection {
	/** Saves a reminder, or returns null when the member already has the most allowed. */
	async create(input: NewReminder): Promise<Reminder | null> {
		const open = await this._db.botReminder.count({
			where: { guildId: input.guildId, userId: input.userId, sentAt: null },
		});
		if (open >= MAX_OPEN_REMINDERS) return null;
		return this._db.botReminder.create({ data: input });
	}

	/** Reminders still waiting in a server, soonest first. */
	async open(guildId: string, limit = 15): Promise<Reminder[]> {
		return this._db.botReminder.findMany({
			where: { guildId, sentAt: null },
			orderBy: { remindAt: 'asc' },
			take: limit,
		});
	}

	/** Reminders whose time has come, in every server. */
	async due(now = new Date(), limit = 20): Promise<Reminder[]> {
		return this._db.botReminder.findMany({
			where: { sentAt: null, remindAt: { lte: now } },
			orderBy: { remindAt: 'asc' },
			take: limit,
		});
	}

	async markSent(id: number): Promise<void> {
		await this._db.botReminder.updateMany({
			where: { id, sentAt: null },
			data: { sentAt: new Date() },
		});
	}

	/** Cancels a waiting reminder; only the member who set it can. */
	async cancel(guildId: string, userId: string, id: number): Promise<boolean> {
		const result = await this._db.botReminder.deleteMany({
			where: { id, guildId, userId, sentAt: null },
		});
		return result.count > 0;
	}
}
