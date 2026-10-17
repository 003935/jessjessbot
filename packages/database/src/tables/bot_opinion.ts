import { DatabaseConnection } from '../connection';

export type BotOpinion = { topic: string; opinion: string; updatedAt: Date };

// Oldest opinions fade out so she doesn't drag around everything she ever said.
const MAX_OPINIONS = 80;

export class BotOpinionTable extends DatabaseConnection {
	async list(guildId: string): Promise<BotOpinion[]> {
		return this._db.botOpinion.findMany({
			where: { guildId },
			orderBy: { updatedAt: 'desc' },
			select: { topic: true, opinion: true, updatedAt: true },
			take: MAX_OPINIONS,
		});
	}

	/** Saves or replaces her opinion on a topic, then trims the oldest past the cap. */
	async save(guildId: string, topic: string, opinion: string): Promise<void> {
		await this._db.botOpinion.upsert({
			where: { guildId_topic: { guildId, topic } },
			create: { guildId, topic, opinion },
			update: { opinion },
		});
		const stale = await this._db.botOpinion.findMany({
			where: { guildId },
			orderBy: { updatedAt: 'desc' },
			skip: MAX_OPINIONS,
			select: { topic: true },
		});
		if (stale.length)
			await this._db.botOpinion.deleteMany({
				where: { guildId, topic: { in: stale.map((row) => row.topic) } },
			});
	}

	async edit(
		guildId: string,
		originalTopic: string,
		topic: string,
		opinion: string
	): Promise<void> {
		await this._db.botOpinion.update({
			where: { guildId_topic: { guildId, topic: originalTopic } },
			data: { topic, opinion },
		});
	}

	async forget(guildId: string, topic: string): Promise<boolean> {
		const result = await this._db.botOpinion.deleteMany({ where: { guildId, topic } });
		return result.count > 0;
	}

	async forgetAll(guildId: string): Promise<number> {
		const result = await this._db.botOpinion.deleteMany({ where: { guildId } });
		return result.count;
	}
}
