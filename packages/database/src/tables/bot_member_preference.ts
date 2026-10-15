import { DatabaseConnection } from '../connection';

export type PreferenceKind = 'like' | 'dislike';
export type MemberPreferences = {
	likes: string[];
	dislikes: string[];
	pets: string[];
	birthday: string | null;
	favourites: string[];
};

const MAX_PREFERENCES = 20;

export class BotMemberPreferenceTable extends DatabaseConnection {
	async list(guildId: string, userId: string): Promise<MemberPreferences> {
		const [rows, savedDetails] = await Promise.all([
			this._db.botMemberPreference.findMany({
				where: { guildId, userId, kind: { in: ['like', 'dislike'] } },
				orderBy: { createdAt: 'asc' },
				take: MAX_PREFERENCES,
			}),
			this._db.botMemberPreference.findMany({
				where: { guildId, userId, kind: { startsWith: 'memory_' } },
				orderBy: { createdAt: 'asc' },
				take: 40,
			}),
		]);
		const pets = savedDetails.filter((row) => row.kind.startsWith('memory_pet_')).map((row) => row.value);
		const favourites = savedDetails
			.filter((row) => row.kind.startsWith('memory_favourite_'))
			.map((row) => row.value);
		const birthday = savedDetails.find((row) => row.kind === 'memory_birthday')?.value ?? null;
		return {
			likes: rows.filter((row) => row.kind === 'like').map((row) => row.value),
			dislikes: rows.filter((row) => row.kind === 'dislike').map((row) => row.value),
			pets,
			birthday,
			favourites,
		};
	}

	async saveDetail(guildId: string, userId: string, kind: string, value: string): Promise<boolean> {
		const existing = await this._db.botMemberPreference.findFirst({ where: { guildId, userId, kind } });
		if (!existing) {
			const count = await this._db.botMemberPreference.count({
				where: { guildId, userId, kind: { startsWith: 'memory_' } },
			});
			if (count >= 40) return false;
		}
		await this.setValue(guildId, userId, kind, value);
		return true;
	}

	async forgetDetail(guildId: string, userId: string, kind: string): Promise<boolean> {
		const result = await this._db.botMemberPreference.deleteMany({ where: { guildId, userId, kind } });
		return result.count > 0;
	}

	async forgetDetailsByPrefix(guildId: string, userId: string, prefix: string): Promise<number> {
		const result = await this._db.botMemberPreference.deleteMany({
			where: { guildId, userId, kind: { startsWith: prefix } },
		});
		return result.count;
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
		const result = await this._db.botMemberPreference.deleteMany({
			where: {
				guildId,
				userId,
				OR: [
					{ kind: { in: ['like', 'dislike', 'nickname'] } },
					{ kind: { startsWith: 'memory_' } },
				],
			},
		});
		return result.count;
	}

	// Single-value markers per member (e.g. the last day they gave jjb a gift).
	async getValue(guildId: string, userId: string, kind: string): Promise<string | null> {
		const row = await this._db.botMemberPreference.findFirst({ where: { guildId, userId, kind } });
		return row?.value ?? null;
	}

	async setValue(guildId: string, userId: string, kind: string, value: string): Promise<void> {
		await this._db.botMemberPreference.deleteMany({ where: { guildId, userId, kind } });
		await this._db.botMemberPreference.create({ data: { guildId, userId, kind, value } });
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
