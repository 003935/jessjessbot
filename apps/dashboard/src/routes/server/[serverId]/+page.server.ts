import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { schema } from '@repo/database';
import { isGuildAdmin } from '$lib/server/permission.utils';
import { discordApi } from '$lib/server/discord';

export const load: PageServerLoad = async ({ parent, params }) => {
	const data = await parent();

	if (!data.user) error(401, 'Not logged in');

	const { isAdmin, guild } = await isGuildAdmin(data.user, params.serverId);

	if (!isAdmin) error(403, 'Not admin');

	const eventGames = await db._db.select().from(schema.eventGameTable);
	const wordleImport = await db.wordleImport.getGuildImport(params.serverId);
	const emojis = await discordApi.getEmojis();

	return {
		guild: {
			...guild,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=128&quality=lossless`
				: null,
		},
		games: eventGames,
		emojis: await emojis,
		user: data.user,
		wordleImport: wordleImport
			? {
					lastImport: wordleImport.lastImport,
					importedBy: wordleImport.importedBy,
					messagesImported: wordleImport.messagesImported,
				}
			: null,
	};
};
