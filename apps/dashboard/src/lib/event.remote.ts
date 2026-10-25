import { command } from '$app/server';
import { getDiscordAcc, throwIfNotLoggedIn } from './server/permission.utils';
import { Custom_Schema } from './event.utils';
import { discordApi } from './server/discord';
import { db } from './server/db';
import { error } from '@sveltejs/kit';
import { ChannelType } from 'discord-api-types/v10';

export const createEvent = command(Custom_Schema, async (custom) => {
	const user = throwIfNotLoggedIn();

	const { guild } = await getDiscordAcc(user, custom.guildId);

	const { custom_channel } = await db.config.getConfig(guild.id);

	if (custom_channel === null) return error(400, 'Custom channel is not configured');

	const guildChannels = await discordApi.getGuildChannels(guild.id);
	const channelInGuild = guildChannels.some(
		(channel) =>
			channel.id === custom_channel &&
			(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
	);
	if (!channelInGuild)
		return error(400, 'Configured custom channel is not a text channel in this server');

	const game_info = await db.games.get(custom.gameName);

	if (game_info === null) return error(400, 'Game does not exist');

	const role = await db.game_roles.get_by_guildId_GameName(guild.id, custom.gameName);
	if (!role)
		return error(
			400,
			`No role is linked to ${custom.gameName}. Link its game role before scheduling a custom.`
		);

	const event_name = custom.name.length > 0 ? custom.name : undefined;

	const messageId = await discordApi.sendCustomMessage(custom_channel, {
		gameName: custom.gameName,
		name: event_name,
		time: custom.time,
		emojiId: game_info.icon ?? undefined,
		roleId: role.roleId,
		teamCount: custom.teamCount,
	});

	const date = new Date(custom.time);

	for (const emoji of custom.teamCount ? ['1️⃣', '2️⃣', '3️⃣', '4️⃣'].slice(0, custom.teamCount) : []) {
		await discordApi.reactToMessage(custom_channel, messageId, encodeURIComponent(emoji));
	}

	await db.events.insert({
		channelId: custom_channel,
		gameName: custom.gameName,
		guildId: guild.id,
		messageId: messageId,
		scheduledTime: date,
		name: event_name,
		teamCount: custom.teamCount,
	});
});
