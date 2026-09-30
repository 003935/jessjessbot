import { DatabaseConnection } from '../connection';

export type HallMessageInput = {
	guildId: string;
	channelId: string;
	messageId: string;
	authorId: string;
	displayName: string;
	preview: string;
	reactions: number;
	createdAt: Date;
};

export class HallTable extends DatabaseConnection {
	async getSavedMessages(guildId: string) {
		return await this._db.hallMessage.findMany({
			where: { guildId },
			select: { channelId: true, messageId: true },
		});
	}

	async rescoreMessage(
		guildId: string,
		channelId: string,
		messageId: string,
		reactions: number,
		preview: string
	) {
		return await this._db.hallMessage.updateMany({
			where: { guildId, channelId, messageId },
			data: { reactions, preview },
		});
	}

	async getChannels(guildId: string, enabledOnly = false) {
		return await this._db.hallChannel.findMany({
			where: { guildId, ...(enabledOnly ? { enabled: true } : {}) },
			orderBy: { channelId: 'asc' },
		});
	}

	async ensureChannels(guildId: string, channelIds: string[]) {
		if (channelIds.length === 0) return;
		await this._db.hallChannel.createMany({
			data: channelIds.map((channelId) => ({ guildId, channelId, enabled: false })),
			skipDuplicates: true,
		});
	}

	async setChannels(guildId: string, channelIds: string[]) {
		await this._db.$transaction(async (tx) => {
			await tx.hallChannel.updateMany({ where: { guildId }, data: { enabled: false } });
			for (const channelId of channelIds) {
				await tx.hallChannel.upsert({
					where: { guildId_channelId: { guildId, channelId } },
					create: { guildId, channelId, enabled: true },
					update: { enabled: true },
				});
			}
		});
	}

	async setChannelEnabled(guildId: string, channelId: string, enabled: boolean) {
		await this._db.hallChannel.upsert({
			where: { guildId_channelId: { guildId, channelId } },
			create: { guildId, channelId, enabled },
			update: { enabled },
		});
	}

	async updateCursor(
		guildId: string,
		channelId: string,
		newestSeen: string | null,
		oldestBefore: string | null,
		complete: boolean
	) {
		await this._db.hallChannel.update({
			where: { guildId_channelId: { guildId, channelId } },
			data: { newestSeen, oldestBefore, backfillComplete: complete },
		});
	}

	async saveMessage(message: HallMessageInput) {
		if (message.reactions <= 2) {
			return false;
		}
		await this._db.hallMessage.upsert({
			where: {
				channelId_messageId: { channelId: message.channelId, messageId: message.messageId },
			},
			create: message,
			update: {
				displayName: message.displayName,
				preview: message.preview,
				reactions: message.reactions,
			},
		});
		return true;
	}

	async saveMessages(messages: HallMessageInput[]) {
		let imported = 0;
		for (let index = 0; index < messages.length; index += 10) {
			const results = await Promise.all(
				messages.slice(index, index + 10).map((message) => this.saveMessage(message))
			);
			imported += results.filter(Boolean).length;
		}
		return imported;
	}

	async removeMessage(channelId: string, messageId: string) {
		await this._db.hallMessage.deleteMany({ where: { channelId, messageId } });
	}

	async getTopMessages(guildId: string, channelIds: string[], authorId?: string, since?: Date) {
		if (channelIds.length === 0) return [];
		return await this._db.hallMessage.findMany({
			where: {
				guildId,
				channelId: { in: channelIds },
				...(authorId ? { authorId } : {}),
				...(since ? { createdAt: { gte: since } } : {}),
			},
			orderBy: [{ reactions: 'desc' }, { createdAt: 'desc' }],
			take: 500,
		});
	}

	async getImport(guildId: string) {
		return await this._db.hallImport.findUnique({ where: { guildId } });
	}

	async saveImport(
		guildId: string,
		importedBy: string,
		messagesScanned: number,
		messagesImported: number
	) {
		await this._db.hallImport.upsert({
			where: { guildId },
			create: { guildId, importedBy, messagesScanned, messagesImported, lastImport: new Date() },
			update: { importedBy, messagesScanned, messagesImported, lastImport: new Date() },
		});
	}
}
