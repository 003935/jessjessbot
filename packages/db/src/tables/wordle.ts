import { DatabaseConnection } from '../connection';
import type { WordleResult } from '../generated/prisma/client';
import { Tries_To_Score } from '../utils';

type User = {
	id: string;
	wins: number;
};

type DailyWins = {
	date: string;
	count: number;
};

type RecentEntry = {
	date: string;
	score: number;
	winner: boolean;
};

type ScoreDistribution = {
	score: number;
	count: number;
};

type UserStats = {
	totalGames: number;
	totalWins: number;
	winRate: number;
	scoreDistribution: ScoreDistribution[];
	averageScore: number | null;
	bestStreak: number;
	currentStreak: number;
	recentActivity: RecentEntry[];
};

type GuildSummary = {
	totalPlayers: number;
	totalGames: number;
	totalWins: number;
	avgScore: number | null;
	avgWinningScore: number | null;
};

type LeaderboardEntry = {
	discordId: string;
	wins: number;
	games: number;
	winRate: number;
	avgScore: number | null;
};

export class WordleTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async size(): Promise<number> {
		return await this._db.wordleResult.count();
	}

	async getSortedWinners(limit: number = 5): Promise<User[]> {
		const win_entries = await this._db.wordleResult.findMany({
			where: { winner: true },
		});
		const users = new Map<string, number>();
		for (const win_entry of win_entries) {
			users.set(win_entry.discordId, (users.get(win_entry.discordId) || 0) + 1);
		}
		const sorted_users = Array.from(users.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit);
		return sorted_users.map(([id, wins]) => ({ id, wins }));
	}

	async getUser(id: string): Promise<User | null> {
		const win_entries = await this._db.wordleResult.findMany({
			where: { discordId: id, winner: true },
		});
		return {
			id,
			wins: win_entries.length,
		};
	}

	async getDailyWinsByGuild(guildId: string): Promise<DailyWins[]> {
		const results = await this._db.$queryRaw<
			{ date: string; count: number }[]
		>`SELECT DATE("message_timestamp")::text as date, COUNT(*)::int as count FROM "winners_Table" WHERE "guildId" = ${guildId} AND winner = true GROUP BY DATE("message_timestamp") ORDER BY DATE("message_timestamp")`;

		return results.map((r) => ({
			date: r.date,
			count: r.count,
		}));
	}

	async getScoreDistributionByGuild(guildId: string): Promise<ScoreDistribution[]> {
		const results = await this._db.wordleResult.groupBy({
			by: ['score'],
			where: { guildId },
			_count: { score: true },
			orderBy: { score: 'asc' },
		});

		return results.map((r) => ({
			score: r.score,
			count: r._count.score,
		}));
	}

	async getUserStats(discordId: string): Promise<UserStats> {
		const allEntries = await this._db.wordleResult.findMany({
			where: { discordId },
			orderBy: { messageTimestamp: 'asc' },
		});

		const totalGames = allEntries.length;
		const totalWins = allEntries.filter((e) => e.winner).length;
		const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

		const scoreDist = new Map<number, number>();
		let scoreSum = 0;
		let scoreCount = 0;

		for (const entry of allEntries) {
			scoreDist.set(entry.score, (scoreDist.get(entry.score) || 0) + 1);
			if (entry.score !== 7) {
				scoreSum += entry.score;
				scoreCount++;
			}
		}

		const scoreDistribution = Array.from(scoreDist.entries())
			.map(([score, count]) => ({ score, count }))
			.sort((a, b) => a.score - b.score);

		const averageScore = scoreCount > 0 ? scoreSum / scoreCount : null;

		let bestStreak = 0;
		let currentStreak = 0;
		for (const entry of allEntries) {
			if (entry.winner) {
				currentStreak++;
				bestStreak = Math.max(bestStreak, currentStreak);
			} else {
				currentStreak = 0;
			}
		}

		const recentEntries = await this._db.wordleResult.findMany({
			where: { discordId },
			select: {
				messageTimestamp: true,
				score: true,
				winner: true,
			},
			orderBy: { messageTimestamp: 'desc' },
			take: 30,
		});

		const recentActivity: RecentEntry[] = recentEntries.map((entry) => ({
			date: entry.messageTimestamp.toISOString(),
			score: entry.score,
			winner: entry.winner,
		}));

		return {
			totalGames,
			totalWins,
			winRate,
			scoreDistribution,
			averageScore,
			bestStreak,
			currentStreak,
			recentActivity,
		};
	}

	async getGuildSummary(guildId: string): Promise<GuildSummary> {
		const allEntries = await this._db.wordleResult.findMany({
			where: { guildId },
		});

		const totalGames = allEntries.length;
		const totalWins = allEntries.filter((e) => e.winner).length;
		const uniquePlayers = new Set(allEntries.map((e) => e.discordId)).size;

		let scoreSum = 0;
		let scoreCount = 0;
		let winScoreSum = 0;
		let winScoreCount = 0;

		for (const entry of allEntries) {
			if (entry.score !== 7) {
				scoreSum += entry.score;
				scoreCount++;
			}
			if (entry.winner && entry.score !== 7) {
				winScoreSum += entry.score;
				winScoreCount++;
			}
		}

		const avgScore = scoreCount > 0 ? scoreSum / scoreCount : null;
		const avgWinningScore = winScoreCount > 0 ? winScoreSum / winScoreCount : null;

		return {
			totalPlayers: uniquePlayers,
			totalGames,
			totalWins,
			avgScore,
			avgWinningScore,
		};
	}

	async getGuildLeaderboardByWins(
		guildId: string,
		limit: number = 10
	): Promise<LeaderboardEntry[]> {
		const allEntries = await this._db.wordleResult.findMany({
			where: { guildId },
		});

		const userMap = new Map<
			string,
			{ wins: number; games: number; scoreSum: number; scoreCount: number }
		>();

		for (const entry of allEntries) {
			const existing = userMap.get(entry.discordId) || {
				wins: 0,
				games: 0,
				scoreSum: 0,
				scoreCount: 0,
			};
			existing.games++;
			if (entry.winner) {
				existing.wins++;
			}
			if (entry.score !== 7) {
				existing.scoreSum += entry.score;
				existing.scoreCount++;
			}
			userMap.set(entry.discordId, existing);
		}

		const leaderboard: LeaderboardEntry[] = Array.from(userMap.entries()).map(
			([discordId, stats]) => ({
				discordId,
				wins: stats.wins,
				games: stats.games,
				winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
				avgScore: stats.scoreCount > 0 ? stats.scoreSum / stats.scoreCount : null,
			})
		);

		leaderboard.sort((a, b) => b.wins - a.wins);
		return leaderboard.slice(0, limit);
	}

	async getGuildLeaderboardByWinRate(
		guildId: string,
		limit: number = 10
	): Promise<LeaderboardEntry[]> {
		const allEntries = await this._db.wordleResult.findMany({
			where: { guildId },
		});

		const userMap = new Map<
			string,
			{ wins: number; games: number; scoreSum: number; scoreCount: number }
		>();

		for (const entry of allEntries) {
			const existing = userMap.get(entry.discordId) || {
				wins: 0,
				games: 0,
				scoreSum: 0,
				scoreCount: 0,
			};
			existing.games++;
			if (entry.winner) {
				existing.wins++;
			}
			if (entry.score !== 7) {
				existing.scoreSum += entry.score;
				existing.scoreCount++;
			}
			userMap.set(entry.discordId, existing);
		}

		const leaderboard: LeaderboardEntry[] = Array.from(userMap.entries()).map(
			([discordId, stats]) => ({
				discordId,
				wins: stats.wins,
				games: stats.games,
				winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
				avgScore: stats.scoreCount > 0 ? stats.scoreSum / stats.scoreCount : null,
			})
		);

		leaderboard.sort((a, b) => b.winRate - a.winRate);
		return leaderboard.slice(0, limit);
	}

	async getGuildLeaderboardByAvgScore(
		guildId: string,
		limit: number = 10
	): Promise<LeaderboardEntry[]> {
		const allEntries = await this._db.wordleResult.findMany({
			where: { guildId },
		});

		const userMap = new Map<
			string,
			{ wins: number; games: number; scoreSum: number; scoreCount: number }
		>();

		for (const entry of allEntries) {
			const existing = userMap.get(entry.discordId) || {
				wins: 0,
				games: 0,
				scoreSum: 0,
				scoreCount: 0,
			};
			existing.games++;
			if (entry.winner) {
				existing.wins++;
			}
			if (entry.score !== 7) {
				existing.scoreSum += entry.score;
				existing.scoreCount++;
			}
			userMap.set(entry.discordId, existing);
		}

		const leaderboard: LeaderboardEntry[] = Array.from(userMap.entries()).map(
			([discordId, stats]) => ({
				discordId,
				wins: stats.wins,
				games: stats.games,
				winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
				avgScore: stats.scoreCount > 0 ? stats.scoreSum / stats.scoreCount : null,
			})
		);

		leaderboard.sort((a, b) => {
			const aVal = a.avgScore ?? Infinity;
			const bVal = b.avgScore ?? Infinity;
			return aVal - bVal;
		});
		return leaderboard.slice(0, limit);
	}

	async addWin(win: {
		guildId: string;
		discordId: string;
		messageId: string;
		channelId: string;
		message_timestamp: Date;
		tries: string;
		winner: boolean;
	}) {
		const existing = await this._db.wordleResult.findUnique({
			where: {
				discordId_channelId_messageId: {
					discordId: win.discordId,
					channelId: win.channelId,
					messageId: win.messageId,
				},
			},
		});

		if (!existing) {
			await this._db.wordleResult.create({
				data: {
					guildId: win.guildId,
					discordId: win.discordId,
					messageId: win.messageId,
					channelId: win.channelId,
					messageTimestamp: win.message_timestamp,
					score: Tries_To_Score(win.tries),
					winner: win.winner,
				},
			});
		}
	}

	async addWins(
		wins: {
			guildId: string;
			discordId: string;
			messageId: string;
			channelId: string;
			message_timestamp: Date;
			tries: string;
			winner: boolean;
		}[]
	) {
		if (wins.length === 0) return;

		await this._db.wordleResult.createMany({
			data: wins.map((w) => ({
				guildId: w.guildId,
				discordId: w.discordId,
				messageId: w.messageId,
				channelId: w.channelId,
				messageTimestamp: w.message_timestamp,
				score: Tries_To_Score(w.tries),
				winner: w.winner,
			})),
			skipDuplicates: true,
		});
	}
}
