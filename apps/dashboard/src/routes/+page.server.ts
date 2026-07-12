import type { PageServerLoad } from './$types';
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

	const discordAccount = await db._db.account.findFirst({
		where: {
			userId: locals.user.id,
			providerId: 'discord',
		},
	});

	if (!discordAccount || !discordAccount.accessToken) {
		return {
			servers: [],
			emojis: [],
			user: locals.user,
			bot_guild_count: (await bot_guilds_promise).length,
		};
	}

	const user_guilds_promise = discordApi.getUserGuilds(locals.user.id, discordAccount.accessToken);

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
