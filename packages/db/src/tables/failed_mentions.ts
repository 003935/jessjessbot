import { DatabaseConnection } from '../connection';
import { FailedMentionStatus } from '../generated/prisma/client';
import { Tries_To_Score } from '../utils';

export type PendingFailedMention = {
	id: number;
	guildId: string;
	displayName: string;
	messageId: string;
	channelId: string;
	message_timestamp: Date;
	score: number;
	winner: boolean;
	status: FailedMentionStatus;
};

export class FailedMentionsTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async size(): Promise<number> {
		return await this._db.failedMention.count();
	}

	async addFailedMention(entry: {
		guildId: string;
		displayName: string;
		messageId: string;
		channelId: string;
		message_timestamp: Date;
		tries: string;
		winner: boolean;
		startOfMention: number;
	}): Promise<void> {
		await this._db.failedMention.createMany({
			data: {
				guildId: entry.guildId,
				displayName: entry.displayName,
				messageId: entry.messageId,
				channelId: entry.channelId,
				messageTimestamp: entry.message_timestamp,
				score: Tries_To_Score(entry.tries),
				winner: entry.winner,
				startOfMention: entry.startOfMention,
			},
			skipDuplicates: true,
		});
	}

	async addFailedMentions(
		entries: {
			guildId: string;
			displayName: string;
			messageId: string;
			channelId: string;
			message_timestamp: Date;
			tries: string;
			winner: boolean;
			startOfMention: number;
		}[]
	): Promise<void> {
		if (entries.length === 0) return;

		await this._db.failedMention.createMany({
			data: entries.map((e) => ({
				guildId: e.guildId,
				displayName: e.displayName,
				messageId: e.messageId,
				channelId: e.channelId,
				messageTimestamp: e.message_timestamp,
				score: Tries_To_Score(e.tries),
				winner: e.winner,
				startOfMention: e.startOfMention,
			})),
			skipDuplicates: true,
		});
	}

	async getFailedMentionByGuildId(guildId: string): Promise<PendingFailedMention[]> {
		const entries = await this._db.failedMention.findMany({
			where: {
				guildId,
				OR: [{ status: FailedMentionStatus.PENDING }, { status: FailedMentionStatus.IGNORED }],
			},
			orderBy: [{ displayName: 'asc' }, { messageTimestamp: 'desc' }],
		});

		return entries.map((e) => ({
			id: e.id,
			guildId: e.guildId,
			displayName: e.displayName,
			messageId: e.messageId,
			channelId: e.channelId,
			message_timestamp: e.messageTimestamp,
			score: e.score,
			winner: e.winner,
			status: e.status,
		}));
	}

	async hide(id: number, adminId: string): Promise<void> {
		await this._db.failedMention.updateMany({
			where: { id, status: FailedMentionStatus.PENDING },
			data: {
				status: FailedMentionStatus.IGNORED,
				resolvedBy: adminId,
				resolvedAt: new Date(),
			},
		});
	}

	async identify(id: number, userId: string, adminId: string): Promise<boolean> {
		const entry = await this._db.failedMention.findFirst({
			where: { id, status: FailedMentionStatus.PENDING },
		});

		if (!entry) return false;

		await this._db.$transaction([
			this._db.failedMention.update({
				where: { id },
				data: {
					status: FailedMentionStatus.RESOLVED,
					resolvedUserId: userId,
					resolvedAt: new Date(),
					resolvedBy: adminId,
				},
			}),
			this._db.wordleResult.createMany({
				data: {
					guildId: entry.guildId,
					discordId: userId,
					messageId: entry.messageId,
					channelId: entry.channelId,
					messageTimestamp: entry.messageTimestamp,
					score: entry.score,
					winner: entry.winner,
				},
				skipDuplicates: true,
			}),
		]);

		return true;
	}
}
