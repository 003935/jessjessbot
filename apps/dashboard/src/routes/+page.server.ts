import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';

export const load: PageServerLoad = async ({ locals }) => {
	const bot_guilds_promise = discordApi.getBotGuilds();

	if (!locals.user)
		return {
			servers: [],
			emojis: [],
			user: null,
			bot_guild_count: (await bot_guilds_promise).length,
		};

	const userId = locals.user.id;
	// getAccessToken refreshes the Discord token if it has expired
	const user_guilds_promise = auth.api
		.getAccessToken({ body: { providerId: 'discord', userId } })
		.then(({ accessToken }) => discordApi.getUserGuilds(userId, accessToken))
		.catch((e: unknown) => {
			console.error('Failed to fetch user guilds:', e);
			return [];
		});

	const emojis_promise = discordApi.getEmojis();

	const [user_guilds, bot_guilds] = await Promise.all([user_guilds_promise, bot_guilds_promise]);

	const joined_guilds = user_guilds.filter((guild) =>
		bot_guilds.some((bot_guild) => bot_guild.id === guild.id)
	);

	const customs = await db.events.getEventsByGuildIds(joined_guilds.map((guild) => guild.id));
	return {
		servers: joined_guilds.map((guild) => ({
			id: guild.id,
			name: guild.name,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=96&quality=lossless`
				: null,
			owner: guild.owner,
			permissions: guild.permissions,
		})),
		emojis: await emojis_promise,
		user: locals.user,
		customs,
		bot_guild_count: bot_guilds.length,
	};
};
