import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';
import { throwIfNotLoggedIn } from '$lib/server/permission.utils';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	throwIfNotLoggedIn(locals);

	const { discordId } = params;

	const serverId = url.searchParams.get('serverId');

	const userStats = await db.wordle.getUserStats(discordId);

	if (userStats.totalGames === 0) {
		error(404, 'No wordle data found for this user');
	}

	let discordUser: {
		username: string;
		displayName: string;
		avatar: string | null;
	} | null = null;

	try {
		const user = await discordApi.getUser(discordId);
		if (user) {
			discordUser = {
				username: user.username,
				displayName: user.global_name || user.username,
				avatar: user.avatar,
			};
		}
	} catch {
		discordUser = null;
	}

	const avatarUrl = discordUser?.avatar
		? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.webp?size=128&quality=lossless`
		: null;

	return {
		discordId,
		displayName: discordUser?.displayName || `User ${discordId}`,
		avatarUrl,
		stats: userStats,
		serverId,
	};
};
