import { DatabaseConnection } from '../connection';
import { type BotMemberBehaviour } from '../generated/prisma/client';

export type { BotMemberBehaviour };

export class BotMemberBehaviourTable extends DatabaseConnection {
	async get(guildId: string, userId: string): Promise<BotMemberBehaviour | null> {
		return this._db.botMemberBehaviour.findUnique({ where: { guildId_userId: { guildId, userId } } });
	}

	async list(guildId: string): Promise<BotMemberBehaviour[]> {
		return this._db.botMemberBehaviour.findMany({ where: { guildId }, orderBy: { updatedAt: 'desc' } });
	}

	async set(
		guildId: string,
		userId: string,
		data: { behaviour: string; when_upset: string | null; updatedBy: string }
	): Promise<void> {
		await this._db.botMemberBehaviour.upsert({
			where: { guildId_userId: { guildId, userId } },
			create: { guildId, userId, ...data },
			update: data,
		});
	}

	async delete(guildId: string, userId: string): Promise<void> {
		await this._db.botMemberBehaviour.deleteMany({ where: { guildId, userId } });
	}
}
