import { DatabaseConnection } from '../connection';

const MAX_SCORE = 5;
const DECAY_MS = 7 * 24 * 60 * 60 * 1000;

function decayedScore(score: number, updatedAt: Date, now: Date): number {
	const days = Math.floor((now.getTime() - updatedAt.getTime()) / DECAY_MS);
	return Math.sign(score) * Math.max(0, Math.abs(score) - Math.max(0, days));
}

export class BotRelationshipTable extends DatabaseConnection {
	async interact(
		guildId: string,
		userId: string,
		delta: -1 | 0 | 1
	): Promise<{ score: number; lastInteractedAt: Date | null }> {
		const now = new Date();
		const current = await this._db.botRelationship.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		const score = Math.max(
			-MAX_SCORE,
			Math.min(
				MAX_SCORE,
				(current ? decayedScore(current.score, current.updatedAt, now) : 0) + delta
			)
		);
		await this._db.botRelationship.upsert({
			where: { guildId_userId: { guildId, userId } },
			create: { guildId, userId, score, interactionCount: 1, updatedAt: now },
			update: { score, interactionCount: { increment: 1 }, updatedAt: now },
		});
		return { score, lastInteractedAt: current?.updatedAt ?? null };
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
			score: decayedScore(row.score, row.updatedAt, now),
			interactionCount: row.interactionCount,
		}));
	}
}
