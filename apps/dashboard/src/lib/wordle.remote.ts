import * as v from 'valibot';
import { query } from '$app/server';
import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { throwIfNotLoggedIn } from './server/permission.utils';

export const getWordleStats = query(v.string(), async (guildId) => {
	const user = throwIfNotLoggedIn();

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: user.id,
			role: user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const scoreDistribution = await db.wordle.getScoreDistributionByGuild(guildId);

	return {
		dist: scoreDistribution,
		total: scoreDistribution.reduce((acc, d) => acc + d.count, 0),
	};
});

export const getUserProfileStats = query(v.string(), async (discordId) => {
	const user = throwIfNotLoggedIn();

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: user.id,
			role: user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const userStats = await db.wordle.getUserStats(discordId);

	return userStats;
});

export const getGuildLeaderboard = query(v.string(), async (guildId) => {
	const user = throwIfNotLoggedIn();

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: user.id,
			role: user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const { byWins, byWinRate, byAvgScore } = await db.wordle.getGuildLeaderboard(guildId);

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
	const user = throwIfNotLoggedIn();

	const can_list = await auth.api.userHasPermission({
		body: {
			userId: user.id,
			role: user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list.success) return error(403, 'Not authorized');

	const summary = await db.wordle.getGuildSummary(guildId);

	return summary;
});
