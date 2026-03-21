import { db, schema } from '@repo/database';
import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { z } from 'zod/v4';
import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { Routes } from 'discord.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return null;

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
		eventGames: await db.select().from(schema.eventsGameTable),
		user: locals.user
	};
};

const addEventGame_Schema = z.object({
	guildId: z.string(),
	gameId: z.string(),
	roleId: z.string()
});

export const actions = {
	addEventGame: async (event) => {
		const data = await event.request.formData();
		const parsed = addEventGame_Schema.safeParse(Object.fromEntries(data.entries()));
		if (!parsed.success) {
			console.log(parsed.error);
			error(400);
			return;
		}

		try {
			await discordApi.get(Routes.guildRole(parsed.data.guildId, parsed.data.roleId));
		} catch {
			error(400, 'Role id does not exist');
			return;
		}

		await db.insert(schema.eventsGameTable).values({
			name: parsed.data.gameId,
			roleId: parsed.data.roleId,
			guildId: parsed.data.guildId
		});
	}
} satisfies Actions;
