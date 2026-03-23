import { schema } from '@repo/database';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import * as v from 'valibot';
import { discordApi } from '$lib/server/discord';
import { Routes } from 'discord.js';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ parent }) => {
	const data = await parent();

	if (!data.user) return {
		servers: [],
		eventGames: [],
		user: null
	};

	const guilds = await discordApi.get(Routes.userGuilds());

	return {
		servers: (
			guilds as {
				id: string;
				name: string;
				icon: string;
			}[]
		).map((guild) => ({
			id: guild.id,
			name: guild.name,
			icon: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=80&quality=lossless`
		})),
		eventGames: await db._db.select().from(schema.eventsGameTable),
		user: data.user
	};
};

const addEventGame_Schema = v.object({
	guildId: v.string(),
	gameId: v.string(),
	roleId: v.string()
});

export const actions = {
	addEventGame: async (event) => {
		const data = await event.request.formData();
		try {
			const parsed = v.parse(addEventGame_Schema, Object.fromEntries(data.entries()));
			await discordApi.get(Routes.guildRole(parsed.guildId, parsed.roleId));

			await db._db.insert(schema.eventsGameTable).values({
				name: parsed.gameId,
				roleId: parsed.roleId,
				guildId: parsed.guildId
			});

		} catch (e) {
			console.log(e);
			error(400);
		}
	}
} satisfies Actions;
