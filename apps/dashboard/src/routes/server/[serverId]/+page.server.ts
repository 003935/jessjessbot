import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getDiscordAcc, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import { discordApi } from '$lib/server/discord';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = throwIfNotLoggedIn(locals);

	const { isAdmin, guild } = await getDiscordAcc(user, params.serverId);

	const eventGames = await db.games.getAll();
	const emojis = await discordApi.getEmojis();

	let wordleImport = null;
	if (isAdmin) {
		wordleImport = await db.wordleImport.getGuildImport(params.serverId);
	}

	return {
		guild: {
			...guild,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=128&quality=lossless`
				: null,
		},
		games: eventGames,
		emojis: await emojis,
		isAdmin,
		wordleImport: wordleImport
			? {
					lastImport: wordleImport.lastImport,
					importedBy: wordleImport.importedBy,
					messagesImported: wordleImport.messagesImported,
				}
			: null,
	};
};
