import * as v from 'valibot';
import { query, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';

export const getWordleStats = query(v.string(), async (guildId) => {
	const { locals } = getRequestEvent();

	if (!locals.user) return error(401, 'Not logged in');

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const scoreDistribution = await db.wordle.getScoreDistributionByGuild(guildId);

	return scoreDistribution;
});

export const getUserProfileStats = query(v.string(), async (discordId) => {
	const { locals } = getRequestEvent();

	if (!locals.user) return error(401, 'Not logged in');

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const userStats = await db.wordle.getUserStats(discordId);

	return userStats;
});

export const getGuildLeaderboard = query(v.string(), async (guildId) => {
	const { locals } = getRequestEvent();

	if (!locals.user) return error(401, 'Not logged in');

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const [byWins, byWinRate, byAvgScore] = await Promise.all([
		db.wordle.getGuildLeaderboardByWins(guildId),
		db.wordle.getGuildLeaderboardByWinRate(guildId),
		db.wordle.getGuildLeaderboardByAvgScore(guildId),
	]);

	const allUsers = new Map<string, (typeof byWins)[number]>();
	for (const entry of [...byWins, ...byWinRate, ...byAvgScore]) {
		allUsers.set(entry.discordId, entry);
	}

	const userMap = new Map<string, { displayName: string; avatarUrl: string | null }>();
	await Promise.all(
		Array.from(allUsers.keys()).map(async (discordId) => {
			let displayName = discordId;
			let avatarUrl: string | null = null;
			try {
				const discordUser = await discordApi.getUser(discordId);
				if (discordUser) {
					displayName = discordUser.global_name || discordUser.username;
					if (discordUser.avatar) {
						avatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.webp?size=32&quality=lossless`;
					}
				}
			} catch {
				displayName = discordId;
			}
			userMap.set(discordId, { displayName, avatarUrl });
		})
	);

	const enrich = (entries: typeof byWins) =>
		entries.map((e) => {
			const user = userMap.get(e.discordId)!;
			return { ...e, ...user };
		});

	return { byWins: enrich(byWins), byWinRate: enrich(byWinRate), byAvgScore: enrich(byAvgScore) };
});

export const getGuildSummary = query(v.string(), async (guildId) => {
	const { locals } = getRequestEvent();

	if (!locals.user) return error(401, 'Not logged in');

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const summary = await db.wordle.getGuildSummary(guildId);

	return summary;
});
