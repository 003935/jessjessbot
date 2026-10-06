import { DatabaseConnection } from '../connection';

// Affection meter. Stored in tenths so it can move by fractions of a point:
// the DB holds -1000..1000, everything outside this file sees -100..100.
// Tuned so someone who's around daily and nice reaches roughly 80 after about a month.
const UNITS = 10;
const MAX_SCORE = 100 * UNITS;
const DAY_MS = 24 * 60 * 60 * 1000;
const DECAY_GRACE_DAYS = 14;
// After two weeks away the meter drifts 3 points a week back towards neutral.
const DECAY_PER_WEEK = 3 * UNITS;
// Turning up on a new day: +0.6, but only up to 30. Showing up alone never makes her close.
const DAILY_VISIT_BONUS = 6;
const DAILY_VISIT_CAP = 30 * UNITS;

function decayedScore(score: number, updatedAt: Date, now: Date): number {
	const idleDays = Math.floor((now.getTime() - updatedAt.getTime()) / DAY_MS);
	const weeks = Math.floor(Math.max(0, idleDays - DECAY_GRACE_DAYS) / 7);
	return Math.sign(score) * Math.max(0, Math.abs(score) - weeks * DECAY_PER_WEEK);
}

function visible(score: number): number {
	return score / UNITS;
}

function isNewDay(previous: Date, now: Date): boolean {
	return previous.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
}

export class BotRelationshipTable extends DatabaseConnection {
	// delta is in tenths of a point (2 = +0.2). Returns the visible -100..100 score.
	async interact(
		guildId: string,
		userId: string,
		delta: number
	): Promise<{ score: number; lastInteractedAt: Date | null }> {
		const now = new Date();
		const current = await this._db.botRelationship.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		const base = current ? decayedScore(current.score, current.updatedAt, now) : 0;
		const visit =
			current && isNewDay(current.updatedAt, now) && base >= 0 && base < DAILY_VISIT_CAP
				? DAILY_VISIT_BONUS
				: 0;
		const score = Math.max(-MAX_SCORE, Math.min(MAX_SCORE, base + visit + delta));
		await this._db.botRelationship.upsert({
			where: { guildId_userId: { guildId, userId } },
			create: { guildId, userId, score, interactionCount: 1, updatedAt: now },
			update: { score, interactionCount: { increment: 1 }, updatedAt: now },
		});
		return { score: visible(score), lastInteractedAt: current?.updatedAt ?? null };
	}

	// Direct change from a gift (delta in tenths): bypasses the per-message daily caps but still
	// respects decay and the bounds. Does not count as an extra interaction.
	async adjust(guildId: string, userId: string, delta: number): Promise<number> {
		const now = new Date();
		const current = await this._db.botRelationship.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		const base = current ? decayedScore(current.score, current.updatedAt, now) : 0;
		const score = Math.max(-MAX_SCORE, Math.min(MAX_SCORE, base + delta));
		await this._db.botRelationship.upsert({
			where: { guildId_userId: { guildId, userId } },
			create: { guildId, userId, score, interactionCount: 1, updatedAt: now },
			update: { score, updatedAt: now },
		});
		return visible(score);
	}

	async favoriteCandidates(guildId: string): Promise<Array<{ userId: string; score: number; interactionCount: number }>> {
		const now = new Date();
		const rows = await this._db.botRelationship.findMany({
			where: { guildId },
			orderBy: { interactionCount: 'desc' },
			take: 1000,
		});
		return rows.map((row) => ({
			userId: row.userId,
			score: visible(decayedScore(row.score, row.updatedAt, now)),
			interactionCount: row.interactionCount,
		}));
	}
}
