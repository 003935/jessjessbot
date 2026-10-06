import { DatabaseConnection } from '../connection';

export type PreferenceKind = 'like' | 'dislike';
export type MemberPreferences = { likes: string[]; dislikes: string[] };

const MAX_PREFERENCES = 20;

export class BotMemberPreferenceTable extends DatabaseConnection {
	async list(guildId: string, userId: string): Promise<MemberPreferences> {
		const rows = await this._db.botMemberPreference.findMany({
			where: { guildId, userId, kind: { in: ['like', 'dislike'] } },
			orderBy: { createdAt: 'asc' },
			take: MAX_PREFERENCES,
		});
		return {
			likes: rows.filter((row) => row.kind === 'like').map((row) => row.value),
			dislikes: rows.filter((row) => row.kind === 'dislike').map((row) => row.value),
		};
	}

	async save(
		guildId: string,
		userId: string,
		kind: PreferenceKind,
		value: string
	): Promise<boolean> {
		const where = { guildId_userId_kind_value: { guildId, userId, kind, value } };
		const existing = await this._db.botMemberPreference.findUnique({ where });
		if (existing) return true;
		const count = await this._db.botMemberPreference.count({
			where: { guildId, userId, kind: { in: ['like', 'dislike'] } },
		});
		if (count >= MAX_PREFERENCES) return false;
		await this._db.botMemberPreference.upsert({
			where,
			create: { guildId, userId, kind, value },
			update: {},
		});
		return true;
	}

	async forget(
		guildId: string,
		userId: string,
		kind: PreferenceKind,
		value: string
	): Promise<boolean> {
		const result = await this._db.botMemberPreference.deleteMany({
			where: { guildId, userId, kind, value },
		});
		return result.count > 0;
	}

	async forgetAll(guildId: string, userId: string): Promise<number> {
		const result = await this._db.botMemberPreference.deleteMany({ where: { guildId, userId } });
		return result.count;
	}

	async setNickname(guildId: string, userId: string, nickname: string): Promise<void> {
		await this._db.botMemberPreference.deleteMany({ where: { guildId, userId, kind: 'nickname' } });
		await this._db.botMemberPreference.create({ data: { guildId, userId, kind: 'nickname', value: nickname } });
	}

	async getNickname(guildId: string, userId: string): Promise<string | null> {
		const row = await this._db.botMemberPreference.findFirst({
			where: { guildId, userId, kind: 'nickname' },
		});
		return row?.value ?? null;
	}

	async clearNickname(guildId: string, userId: string): Promise<void> {
		await this._db.botMemberPreference.deleteMany({ where: { guildId, userId, kind: 'nickname' } });
	}

	async findNicknameUsers(guildId: string, nickname: string): Promise<string[]> {
		const rows = await this._db.botMemberPreference.findMany({
			where: { guildId, kind: 'nickname', value: nickname },
			select: { userId: true },
			take: 5,
		});
		return rows.map((row) => row.userId);
	}
}
