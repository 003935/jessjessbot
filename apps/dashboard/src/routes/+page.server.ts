import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { schema } from '@repo/database';
import { and, eq } from 'drizzle-orm';
import { discordApi } from '$lib/server/discord';

export const load: PageServerLoad = async ({ parent }) => {
	const data = await parent();

	if (!data.user)
		return {
			servers: [],
			emojis: [],
			user: null,
		};

	const discordAccounts = await db._db
		.select()
		.from(schema.account)
		.where(and(eq(schema.account.userId, data.user.id), eq(schema.account.providerId, 'discord')));

	const discordAccount = discordAccounts[0];

	if (!discordAccount || !discordAccount.accessToken) {
		return {
			servers: [],
			emojis: [],
			user: data.user,
		};
	}

	const user_guilds_promise = discordApi.getUserGuilds(data.user.id, discordAccount.accessToken);
	const bot_guilds_promise = discordApi.getBotGuilds();

	const emojis_promise = discordApi.getEmojis();

	const [user_guilds, bot_guilds] = await Promise.all([user_guilds_promise, bot_guilds_promise]);

	const joined_guilds = user_guilds.filter((guild) =>
		bot_guilds.some((bot_guild) => bot_guild.id === guild.id)
	);

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
		user: data.user,
	};
};
