import type { PageServerLoad } from './$types';
import { discordApi } from '$lib/server/discord';
import { error } from '@sveltejs/kit';
import { Routes, type RESTGetAPIGuildResult } from 'discord-api-types/v10';
import { isGuildAdmin } from '$lib/server/discord.utils';
import { db } from '$lib/server/db';
import { schema } from '@repo/database';

export const load: PageServerLoad = async ({ parent, params }) => {
	const data = await parent();

	if (!data.user) error(401, 'Not logged in');

	const guild = (await discordApi.get(Routes.guild(params.serverId))) as RESTGetAPIGuildResult;

	const isAdmin = await isGuildAdmin(data.user.id, guild);

	if (!isAdmin) error(403, 'Not admin');

	const games = await db._db.select().from(schema.eventGameTable);

	return {
		guild: {
			...guild,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=128&quality=lossless`
				: null,
		},
		games,
		user: data.user,
	};
};
