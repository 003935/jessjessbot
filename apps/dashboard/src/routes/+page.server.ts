import type { PageServerLoad } from './$types';
import { REST } from '@discordjs/rest';
import { db } from '$lib/server/db';
import { schema } from '@repo/database';
import { and, eq } from 'drizzle-orm';
import { Routes, type RESTGetAPICurrentUserGuildsResult } from 'discord-api-types/v10';
import { discordApi } from '$lib/server/discord';

export const load: PageServerLoad = async ({ parent }) => {
	const data = await parent();

	if (!data.user)
		return {
			servers: [],
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
			user: data.user,
		};
	}

	const user_discordApi = new REST({ authPrefix: 'Bearer' }).setToken(discordAccount.accessToken);

	const user_guilds = (await user_discordApi.get(
		Routes.userGuilds()
	)) as RESTGetAPICurrentUserGuildsResult;

	const bot_guilds = (await discordApi.get(
		Routes.userGuilds()
	)) as RESTGetAPICurrentUserGuildsResult;

	const joined_guilds = user_guilds.filter((guild) =>
		bot_guilds.some((bot_guild) => bot_guild.id === guild.id)
	);

	return {
		servers: joined_guilds.map((guild) => ({
			id: guild.id,
			name: guild.name,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=80&quality=lossless`
				: null,
			owner: guild.owner,
			permissions: guild.permissions,
		})),
		user: data.user,
	};
};
