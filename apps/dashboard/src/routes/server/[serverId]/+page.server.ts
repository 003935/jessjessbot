import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getDiscordAcc, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import { discordApi } from '$lib/server/discord';
import { ChannelType } from 'discord-api-types/v10';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = throwIfNotLoggedIn(locals);

	const { isAdmin, guild } = await getDiscordAcc(user, params.serverId);

	const eventGames = await db.games.getAll();
	const emojis = await discordApi.getEmojis();

	let channels: null | Awaited<ReturnType<typeof discordApi.getGuildChannels>> = null;
	let wordleImport: null | Awaited<ReturnType<typeof db.wordleImport.getGuildImport>> = null;
	let config: null | Awaited<ReturnType<typeof db.config.getConfig>> = null;
	let hallChannels: Awaited<ReturnType<typeof db.hall.getChannels>> = [];
	let hallImport: Awaited<ReturnType<typeof db.hall.getImport>> = null;
	if (isAdmin) {
		channels = await discordApi.getGuildChannels(guild.id);
		wordleImport = await db.wordleImport.getGuildImport(params.serverId);
		config = await db.config.getConfig(guild.id);
		hallChannels = await db.hall.getChannels(guild.id, true);
		hallImport = await db.hall.getImport(guild.id);
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
		channels: channels
			?.filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
			.map((c) => ({ id: c.id, name: c.name })),
		config,
		wordleImport: wordleImport
			? {
					lastImport: wordleImport.lastImport,
					importedBy: wordleImport.importedBy,
					messagesImported: wordleImport.messagesImported,
				}
			: null,
		hallChannelIds: hallChannels.map((channel) => channel.channelId),
		hallImport: hallImport
			? {
					lastImport: hallImport.lastImport,
					messagesScanned: hallImport.messagesScanned,
					messagesImported: hallImport.messagesImported,
				}
			: null,
	};
};
