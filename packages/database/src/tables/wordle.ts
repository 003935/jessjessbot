import { DatabaseConnection } from '../connection';
import type { WordleResult } from '../generated/prisma/client';
import { FailedMentionStatus, Tries_To_Score, type WordleResultMessage } from '../utils';

type User = {
	id: string;
	wins: number;
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

	async getSortedWinners(guildId: string, limit: number = 5): Promise<User[]> {
		const entries = await this._db.wordleResult.findMany({
			where: { message: { guildId } },
			select: {
				discordId: true,
				score: true,
				message: {
					select: {
						winningScore: true,
					},
				},
			},
		});
		const win_entries = entries.filter((e) => e.score === e.message.winningScore);

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
		const entries = await this._db.wordleResult.findMany({
			where: { discordId: id },
			select: {
				score: true,
				message: {
					select: {
						winningScore: true,
					},
				},
			},
		});

		const wins = entries.reduce((acc, entry) => {
			if (entry.score === entry.message.winningScore) {
				return acc + 1;
			}
			return acc;
		}, 0);

		return {
			id,
			wins,
		};
	}

	async getScoreDistributionByGuild(guildId: string): Promise<ScoreDistribution[]> {
		const results = await this._db.wordleResult.groupBy({
			by: ['score'],
			where: { message: { guildId } },
			_count: { score: true },
			orderBy: { score: 'asc' },
		});

		return results.map((r) => ({
			score: r.score,
			count: r._count.score,
		}));
	}

	async getUserStats(discordId: string): Promise<UserStats> {
		const allEntries = (
			await this._db.wordleResult.findMany({
				where: { discordId },
				select: {
					messageId: true,
					channelId: true,
					discordId: true,
					score: true,
					message: {
						select: {
							winningScore: true,
							messageTimestamp: true,
						},
					},
				},
				orderBy: { message: { messageTimestamp: 'asc' } },
			})
		).map((e) => ({
			...e,
			winner: e.score === e.message.winningScore,
		}));

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

		const recentEntries = allEntries.slice(0, 30);

		const recentActivity: RecentEntry[] = recentEntries.map((entry) => ({
			date: entry.message.messageTimestamp.toISOString(),
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
		const allEntries = (
			await this._db.wordleResult.findMany({
				where: { message: { guildId } },
				select: {
					messageId: true,
					channelId: true,
					discordId: true,
					score: true,
					message: {
						select: {
							winningScore: true,
						},
					},
				},
			})
		).map((e) => ({
			...e,
			winner: e.score === e.message.winningScore,
		}));

		const totalGames = new Set(allEntries.map((e) => e.channelId + e.messageId)).size;
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

	async getGuildLeaderboard(
		guildId: string,
		limit: number = 10
	): Promise<{
		byWins: LeaderboardEntry[];
		byWinRate: LeaderboardEntry[];
		byAvgScore: LeaderboardEntry[];
	}> {
		const allEntries = (
			await this._db.wordleResult.findMany({
				where: { message: { guildId } },
				select: {
					discordId: true,
					score: true,
					message: {
						select: {
							winningScore: true,
						},
					},
				},
			})
		).map((e) => ({
			...e,
			winner: e.score === e.message.winningScore,
		}));

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

		return {
			byWins: [...leaderboard].sort((a, b) => b.wins - a.wins).slice(0, limit),
			byWinRate: [...leaderboard].sort((a, b) => b.winRate - a.winRate).slice(0, limit),
			byAvgScore: [...leaderboard]
				.sort((a, b) => {
					const aVal = a.avgScore ?? Infinity;
					const bVal = b.avgScore ?? Infinity;
					return aVal - bVal;
				})
				.slice(0, limit),
		};
	}

	async addWordleResultMessage(result: WordleResultMessage) {
		return await this._db.$transaction(async (tx) => {
			const entry = await tx.wordleResultMessage.findUnique({
				where: {
					channelId_messageId: {
						channelId: result.channelId,
						messageId: result.messageId,
					},
				},
			});

			if (entry !== null) {
				return false;
			}

			await tx.wordleResultMessage.create({
				data: {
					guildId: result.guildId,
					messageId: result.messageId,
					channelId: result.channelId,
					messageTimestamp: result.messageTimestamp,
					winningScore: result.winningScore,
					players: {
						createMany: {
							data: Array.from(result.players.values()).map((p) => ({
								discordId: p.discordId,
								score: p.score,
							})),
						},
					},
					failedMentions: {
						createMany: {
							data: Array.from(result.failedMentions.values()).map((fm) => ({
								displayName: fm.displayName,
								score: fm.score,
								startOfMention: fm.startOfMention,
							})),
						},
					},
				},
			});
			return true;
		});
	}

	async addWordleResultMessages(results: WordleResultMessage[]) {
		if (results.length === 0) return { failed: 0, succeeded: 0, alreadyExists: 0 };

		let succeeded = 0;
		let alreadyExists = 0;
		let failed = 0;

		for (const result of results) {
			try {
				const added = await this._db.$transaction(async (tx) => {
					const exists = await tx.wordleResultMessage.findUnique({
						where: {
							channelId_messageId: {
								channelId: result.channelId,
								messageId: result.messageId,
							},
						},
					});

					if (exists !== null) {
						return false;
					}

					await tx.wordleResultMessage.create({
						data: {
							guildId: result.guildId,
							messageId: result.messageId,
							channelId: result.channelId,
							messageTimestamp: result.messageTimestamp,
							winningScore: result.winningScore,
							players: {
								createMany: {
									data: Array.from(result.players.values()).map((p) => ({
										discordId: p.discordId,
										score: p.score,
									})),
								},
							},
							failedMentions: {
								createMany: {
									data: Array.from(result.failedMentions.values()).map((fm) => ({
										displayName: fm.displayName,
										score: fm.score,
										startOfMention: fm.startOfMention,
									})),
								},
							},
						},
					});
					return true;
				});
				if (added) succeeded++;
				else alreadyExists++;
			} catch (e) {
				console.error(`Failed to add wordle result message ${result.messageId}:`, e);
				failed++;
			}
		}

		return { failed, succeeded, alreadyExists };
	}
}
