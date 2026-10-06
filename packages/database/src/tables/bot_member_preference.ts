import { DatabaseConnection } from '../connection';

export type PreferenceKind = 'like' | 'dislike';
export type MemberPreferences = { likes: string[]; dislikes: string[] };

const MAX_PREFERENCES = 20;

export class BotMemberPreferenceTable extends DatabaseConnection {
	async list(guildId: string, userId: string): Promise<MemberPreferences> {
		const rows = await this._db.botMemberPreference.findMany({
			where: { guildId, userId },
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
		const count = await this._db.botMemberPreference.count({ where: { guildId, userId } });
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
}
