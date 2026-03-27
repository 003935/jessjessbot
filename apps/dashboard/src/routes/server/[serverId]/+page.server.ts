import type { PageServerLoad } from './$types';
import { discordApi } from '$lib/server/discord';
import { error } from '@sveltejs/kit';
import { _isGuildAdmin } from '$lib/server/discord.utils';
import { db } from '$lib/server/db';
import { schema } from '@repo/database';

export const load: PageServerLoad = async ({ parent, params }) => {
	const data = await parent();

	if (!data.user) error(401, 'Not logged in');

	const guild_promise = discordApi.getGuild(params.serverId);

	const isAdmin = await _isGuildAdmin(data.user.id, guild_promise);

	if (!isAdmin) error(403, 'Not admin');

	const eventGames = await db._db.select().from(schema.eventGameTable);

	const guild = await guild_promise;

	return {
		guild: {
			...guild,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=128&quality=lossless`
				: null,
		},
		games: eventGames,
		user: data.user,
	};
};
