import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getDiscordAcc, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import { discordApi } from '$lib/server/discord';
import { ChannelType } from 'discord-api-types/v10';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = throwIfNotLoggedIn(locals);

	const { isAdmin, guild } = await getDiscordAcc(user, params.serverId);

	const eventGames = await db.games.getAll();
	const upcomingCustoms = await Promise.all(
		(await db.events.getEventsByGuildIds([guild.id]))
			.filter((event) => event.scheduledTime.getTime() > Date.now())
			.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
			.slice(0, 10)
			.map(async (event) => {
				const signups = await db.events.getSignups(event.id);
				const overrides = new Map(signups.map((signup) => [signup.userId, signup.status]));
				const teamEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'].slice(0, event.teamCount || 0);
				const reactionUsers = await Promise.all(
					(event.teamCount ? teamEmoji : ['✅']).map((emoji) =>
						discordApi.getReactionUsers(event.channelId, event.messageId, emoji).catch(() => [])
					)
				);
				const legacyIds = new Set(
					reactionUsers
						.flat()
						.filter((member) => !overrides.has(member.id))
						.map((member) => member.id)
				);
				const storedJoinedIds = new Set(
					signups.filter((signup) => signup.status === 'JOINED').map((signup) => signup.userId)
				);
				return {
					id: event.id,
					gameName: event.gameName,
					name: event.name,
					channelId: event.channelId,
					messageId: event.messageId,
					scheduledTime: event.scheduledTime.toISOString(),
					joinedCount: new Set([...legacyIds, ...storedJoinedIds]).size,
					maybeCount: signups.filter((signup) => signup.status === 'MAYBE').length,
				};
			})
	);
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
		upcomingCustoms,
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
