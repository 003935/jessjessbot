import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';

export const load: PageServerLoad = async ({ locals, request }) => {
	const bot_guilds_promise = discordApi.getBotGuilds();

	if (!locals.user)
		return {
			servers: [],
			emojis: [],
			user: null,
			bot_guild_count: (await bot_guilds_promise).length,
		};

	// Discord access tokens expire after a week; getAccessToken refreshes them when needed.
	// If Discord still rejects the token (refresh failed or access revoked), ask for a fresh login
	// instead of failing the whole page.
	let user_guilds: Awaited<ReturnType<typeof discordApi.getUserGuilds>>;
	try {
		const { accessToken } = await auth.api.getAccessToken({
			body: { providerId: 'discord' },
			headers: request.headers,
		});
		user_guilds = await discordApi.getUserGuilds(locals.user.id, accessToken);
	} catch (err) {
		console.warn('[Dashboard] Could not load Discord guilds, asking for a fresh login:', err);
		return {
			servers: [],
			emojis: [],
			user: locals.user,
			discordLoginExpired: true,
			bot_guild_count: (await bot_guilds_promise).length,
		};
	}

	const emojis_promise = discordApi.getEmojis();

	const bot_guilds = await bot_guilds_promise;

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
