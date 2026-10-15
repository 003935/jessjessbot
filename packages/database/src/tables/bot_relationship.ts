import { DatabaseConnection } from '../connection';

// Affection meter. Stored in tenths so it can move by fractions of a point:
// the DB holds -1000..1000, everything outside this file sees -100..100.
const UNITS = 10;
const MAX_SCORE = 100 * UNITS;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSE = 50 * UNITS;

// Being nice builds a streak of days in a row; each streak day is worth 1.5x the last:
// +1.5 a message on day 1, 2.3 on day 2, 3.4, 5.1, 7.6, then capped at 9.
// Up to three nice messages count per day. A week of daily niceness gets someone close.
const NICE_BASE = 15;
const STREAK_GROWTH = 1.5;
const MAX_STREAK_MULTIPLIER = 6;
const NICE_MESSAGES_PER_DAY = 3;
// Being mean escalates within a day: -3, then -6, then -12, at most -30 a day,
// and it wipes their nice streak.
const MEAN_BASE = 30;
const DAILY_LOSS_CAP = 300;
// Turning up on a new day: +0.6, but only up to 30. Showing up alone never makes her close.
const DAILY_VISIT_BONUS = 6;
const DAILY_VISIT_CAP = 30 * UNITS;
// Going quiet: 3 days grace, then the meter drifts towards neutral by 1 a day,
// and 2 a day once they've been gone over a week.
const ABSENCE_GRACE_DAYS = 3;
const SLOW_DECAY_UNTIL_DAY = 10;
const SLOW_DECAY_PER_DAY = 1 * UNITS;
const FAST_DECAY_PER_DAY = 2 * UNITS;

export type MeterState = {
	score: number;
	updatedAt: Date;
	niceStreak: number;
	lastNiceDay: string | null;
	day: string | null;
	dayGain: number;
	dayMeanCount: number;
};
export type MeterUpdate = Omit<MeterState, 'updatedAt'>;

function dayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function daysAway(updatedAt: Date, now: Date): number {
	return Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / DAY_MS));
}

export function decayedScore(score: number, updatedAt: Date, now: Date): number {
	const idle = daysAway(updatedAt, now) - ABSENCE_GRACE_DAYS;
	if (idle <= 0) return score;
	const slowDays = Math.min(idle, SLOW_DECAY_UNTIL_DAY - ABSENCE_GRACE_DAYS);
	const fastDays = Math.max(0, idle - slowDays);
	const decay = slowDays * SLOW_DECAY_PER_DAY + fastDays * FAST_DECAY_PER_DAY;
	return Math.sign(score) * Math.max(0, Math.abs(score) - decay);
}

/** Per-message gain on a given streak day, halved once they are already close. */
export function niceGain(streak: number, score: number): number {
	const multiplier = Math.min(STREAK_GROWTH ** Math.max(0, streak - 1), MAX_STREAK_MULTIPLIER);
	const gain = Math.round(NICE_BASE * multiplier);
	return score >= CLOSE ? Math.round(gain / 2) : gain;
}

/** Works out the meter after one message. mood: 1 nice, -1 mean, 0 neither. */
export function applyInteraction(
	current: MeterState | null,
	mood: -1 | 0 | 1,
	now: Date
): MeterUpdate {
	const today = dayKey(now);
	const yesterday = dayKey(new Date(now.getTime() - DAY_MS));
	const base = current ? decayedScore(current.score, current.updatedAt, now) : 0;
	const sameDay = current?.day === today;
	let dayGain = sameDay ? current!.dayGain : 0;
	let dayMeanCount = sameDay ? current!.dayMeanCount : 0;
	let niceStreak = current?.niceStreak ?? 0;
	let lastNiceDay = current?.lastNiceDay ?? null;
	// A streak only survives if the last nice day was today or yesterday.
	if (lastNiceDay !== today && lastNiceDay !== yesterday) niceStreak = 0;
	let delta =
		current && dayKey(current.updatedAt) !== today && base >= 0 && base < DAILY_VISIT_CAP
			? DAILY_VISIT_BONUS
			: 0;
	if (mood > 0) {
		if (lastNiceDay !== today) niceStreak += 1;
		lastNiceDay = today;
		const gain = niceGain(niceStreak, base);
		const allowed = Math.max(0, Math.min(gain, gain * NICE_MESSAGES_PER_DAY - dayGain));
		dayGain += allowed;
		delta += allowed;
	} else if (mood < 0) {
		const lostSoFar = MEAN_BASE * (2 ** dayMeanCount - 1);
		const loss = Math.min(MEAN_BASE * 2 ** dayMeanCount, Math.max(0, DAILY_LOSS_CAP - lostSoFar));
		dayMeanCount += 1;
		niceStreak = 0;
		lastNiceDay = null;
		delta -= loss;
	}
	return {
		score: Math.max(-MAX_SCORE, Math.min(MAX_SCORE, base + delta)),
		niceStreak,
		lastNiceDay,
		day: today,
		dayGain,
		dayMeanCount,
	};
}

function visible(score: number): number {
	return score / UNITS;
}

export type RelationshipState = {
	score: number;
	lastInteractedAt: Date | null;
	interactionCount: number;
	niceStreak: number;
	daysAway: number;
};

export class BotRelationshipTable extends DatabaseConnection {
	/** Records one message to jjb. mood: 1 nice, -1 mean, 0 neither. */
	async interact(
		guildId: string,
		userId: string,
		mood: -1 | 0 | 1
	): Promise<RelationshipState> {
		const now = new Date();
		const current = await this._db.botRelationship.findUnique({
			where: { guildId_userId: { guildId, userId } },
		});
		const next = applyInteraction(current, mood, now);
		await this._db.botRelationship.upsert({
			where: { guildId_userId: { guildId, userId } },
			create: { guildId, userId, ...next, interactionCount: 1, updatedAt: now },
			update: { ...next, interactionCount: { increment: 1 }, updatedAt: now },
		});
		return {
			score: visible(next.score),
			lastInteractedAt: current?.updatedAt ?? null,
			interactionCount: (current?.interactionCount ?? 0) + 1,
			niceStreak: next.niceStreak,
			daysAway: current ? daysAway(current.updatedAt, now) : 0,
		};
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
