import { DatabaseConnection } from '../connection';
import { FailedMentionStatus, Prisma } from '../generated/prisma/client';

export type FailedMention = FailedMentionId & {
	guildId: string;
	displayName: string;
	message_timestamp: Date;
	score: number;
	winner: boolean;
	status: FailedMentionStatus;
};

export type FailedMentionId = {
	channelId: string;
	messageId: string;
	startOfMention: number;
};

export class FailedMentionsTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async size(): Promise<number> {
		return await this._db.failedMention.count();
	}

	async getFailedMentionByGuildId(guildId: string): Promise<FailedMention[]> {
		const entries = (
			await this._db.failedMention.findMany({
				where: {
					message: {
						guildId,
					},
					status: {
						in: [FailedMentionStatus.PENDING, FailedMentionStatus.IGNORED],
					},
				},
				select: {
					messageId: true,
					channelId: true,
					displayName: true,
					score: true,
					status: true,
					startOfMention: true,
					message: {
						select: {
							guildId: true,
							messageTimestamp: true,
							winningScore: true,
						},
					},
				},
				orderBy: [{ displayName: 'asc' }, { message: { messageTimestamp: 'desc' } }],
			})
		).map((e) => ({
			...e,
			winner: e.score === e.message.winningScore,
		}));

		return entries.map((e) => ({
			guildId: e.message.guildId,
			displayName: e.displayName,
			messageId: e.messageId,
			channelId: e.channelId,
			startOfMention: e.startOfMention,
			message_timestamp: e.message.messageTimestamp,
			score: e.score,
			winner: e.winner,
			status: e.status,
		}));
	}

	async hide(id: FailedMentionId, adminDiscordId: string): Promise<void> {
		try {
			await this._db.failedMention.update({
				where: {
					channelId_messageId_startOfMention: id,
					status: FailedMentionStatus.PENDING,
				},
				data: {
					status: FailedMentionStatus.IGNORED,
					updatedByDiscordId: adminDiscordId,
				},
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2025') {
					return;
				}
			}
			throw e;
		}
	}

	async identifyByDisplayName(
		displayName: string,
		guildId: string,
		userId: string,
		adminDiscordId: string
	): Promise<{
		success: boolean;
		message: string;
		count: number;
	}> {
		return await this._db.$transaction(async (tx) => {
			const entries = await tx.failedMention.findMany({
				where: {
					displayName,
					status: FailedMentionStatus.PENDING,
					message: {
						guildId,
					},
				},
			});

			if (entries.length === 0) {
				return {
					success: false,
					message: 'No pending mentions found with that display name',
					count: 0,
				};
			}

			let resolvedCount = 0;

			for (const entry of entries) {
				const existing_entry = await tx.wordleResult.findUnique({
					where: {
						channelId_messageId_discordId: {
							channelId: entry.channelId,
							messageId: entry.messageId,
							discordId: userId,
						},
					},
				});

				if (existing_entry) {
					continue;
				}

				await tx.failedMention.update({
					where: {
						channelId_messageId_startOfMention: {
							channelId: entry.channelId,
							messageId: entry.messageId,
							startOfMention: entry.startOfMention,
						},
						status: FailedMentionStatus.PENDING,
					},
					data: {
						status: FailedMentionStatus.RESOLVED,
						resolvedDiscordId: userId,
						updatedByDiscordId: adminDiscordId,
					},
				});

				await tx.wordleResult.create({
					data: {
						channelId: entry.channelId,
						messageId: entry.messageId,
						discordId: userId,
						score: entry.score,
					},
				});

				resolvedCount++;
			}

			return {
				success: true,
				message: `Resolved ${resolvedCount} mention${resolvedCount !== 1 ? 's' : ''} for @${displayName}`,
				count: resolvedCount,
			};
		});
	}

	async identify(
		id: FailedMentionId,
		userId: string,
		adminDiscordId: string
	): Promise<{
		success: boolean;
		message: string;
	}> {
		return await this._db.$transaction(async (tx) => {
			const entry = await tx.failedMention.findUnique({
				where: {
					channelId_messageId_startOfMention: id,
					status: FailedMentionStatus.PENDING,
				},
			});

			if (!entry) {
				return {
					success: false,
					message: 'Failed mention not found',
				};
			}

			const existing_entry = await tx.wordleResult.findUnique({
				where: {
					channelId_messageId_discordId: {
						channelId: entry.channelId,
						messageId: entry.messageId,
						discordId: userId,
					},
				},
			});

			if (existing_entry) {
				return {
					success: false,
					message: 'User already has a score for this message',
				};
			}

			await tx.failedMention.update({
				where: {
					channelId_messageId_startOfMention: id,
					status: FailedMentionStatus.PENDING,
				},
				data: {
					status: FailedMentionStatus.RESOLVED,
					resolvedDiscordId: userId,
					updatedByDiscordId: adminDiscordId,
				},
			});

			await tx.wordleResult.create({
				data: {
					channelId: entry.channelId,
					messageId: entry.messageId,
					discordId: userId,
					score: entry.score,
				},
			});

			return {
				success: true,
				message: 'Failed mention identified successfully',
			};
		});
	}
}
