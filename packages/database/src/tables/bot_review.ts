import { DatabaseConnection } from '../connection';

export type ReviewTarget = 'note' | 'opinion';

export type ReviewFlagInput = {
	target: ReviewTarget;
	/** The note's owner; empty for opinions. */
	userId: string;
	/** Note kind (memory_...) or opinion topic. */
	key: string;
	text: string;
	reason: string;
};

export type ReviewFlag = ReviewFlagInput & {
	id: number;
	status: 'open' | 'kept';
	createdAt: Date;
};

export type BotReviewInput = {
	periodStart: Date;
	periodEnd: Date;
	summary: string;
	report: string;
};

export type BotReview = BotReviewInput & { id: number; createdAt: Date };

const sameItem = (a: ReviewFlagInput, b: ReviewFlagInput) =>
	a.target === b.target && a.userId === b.userId && a.key === b.key;

/**
 * Which flags to write after a review. Kept flags whose text hasn't changed stay kept, so an
 * admin's "keep" sticks; if the note or opinion has changed since, it's flagged again.
 */
export function flagsToWrite(
	incoming: ReviewFlagInput[],
	kept: ReviewFlagInput[]
): { create: ReviewFlagInput[]; reopen: ReviewFlagInput[] } {
	const create: ReviewFlagInput[] = [];
	const reopen: ReviewFlagInput[] = [];
	const seen: ReviewFlagInput[] = [];
	for (const flag of incoming) {
		if (seen.some((other) => sameItem(other, flag))) continue;
		seen.push(flag);
		const previous = kept.find((other) => sameItem(other, flag));
		if (!previous) create.push(flag);
		else if (previous.text !== flag.text) reopen.push(flag);
	}
	return { create, reopen };
}

export class BotReviewTable extends DatabaseConnection {
	async listFlags(guildId: string, status: 'open' | 'kept' = 'open'): Promise<ReviewFlag[]> {
		const rows = await this._db.botReviewFlag.findMany({
			where: { guildId, status },
			orderBy: { createdAt: 'asc' },
		});
		return rows.map((row) => ({
			id: row.id,
			target: row.target as ReviewTarget,
			userId: row.userId,
			key: row.key,
			text: row.text,
			reason: row.reason,
			status: row.status as 'open' | 'kept',
			createdAt: row.createdAt,
		}));
	}

	async getFlag(guildId: string, id: number): Promise<ReviewFlag | null> {
		const row = await this._db.botReviewFlag.findFirst({ where: { guildId, id } });
		return row
			? {
					id: row.id,
					target: row.target as ReviewTarget,
					userId: row.userId,
					key: row.key,
					text: row.text,
					reason: row.reason,
					status: row.status as 'open' | 'kept',
					createdAt: row.createdAt,
				}
			: null;
	}

	/** A new review replaces every open flag for the server. Returns how many are open now. */
	async replaceOpenFlags(guildId: string, flags: ReviewFlagInput[]): Promise<number> {
		const kept = await this.listFlags(guildId, 'kept');
		const { create, reopen } = flagsToWrite(flags, kept);
		await this._db.$transaction([
			this._db.botReviewFlag.deleteMany({ where: { guildId, status: 'open' } }),
			...reopen.map((flag) =>
				this._db.botReviewFlag.update({
					where: {
						guildId_target_userId_key: {
							guildId,
							target: flag.target,
							userId: flag.userId,
							key: flag.key,
						},
					},
					data: { text: flag.text, reason: flag.reason, status: 'open', createdAt: new Date() },
				})
			),
			this._db.botReviewFlag.createMany({
				data: create.map((flag) => ({ ...flag, guildId })),
				skipDuplicates: true,
			}),
		]);
		return create.length + reopen.length;
	}

	async keep(guildId: string, id: number): Promise<boolean> {
		const result = await this._db.botReviewFlag.updateMany({
			where: { guildId, id },
			data: { status: 'kept' },
		});
		return result.count > 0;
	}

	async deleteFlag(guildId: string, id: number): Promise<void> {
		await this._db.botReviewFlag.deleteMany({ where: { guildId, id } });
	}

	/** Drops the flag on a note or opinion that was just deleted. */
	async dropFor(guildId: string, target: ReviewTarget, userId: string, key: string): Promise<void> {
		await this._db.botReviewFlag.deleteMany({ where: { guildId, target, userId, key } });
	}

	async dropAllFor(guildId: string, target: ReviewTarget): Promise<void> {
		await this._db.botReviewFlag.deleteMany({ where: { guildId, target } });
	}

	async saveReview(guildId: string, review: BotReviewInput): Promise<BotReview> {
		return this._db.botReview.create({ data: { ...review, guildId } });
	}

	async latestReview(guildId: string): Promise<BotReview | null> {
		return this._db.botReview.findFirst({ where: { guildId }, orderBy: { createdAt: 'desc' } });
	}
}
