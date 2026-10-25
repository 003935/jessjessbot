import { command } from '$app/server';
import { getDiscordAcc, throwIfNotLoggedIn } from './server/permission.utils';
import { db } from './server/db';
import { discordApi } from './server/discord';
import { error } from '@sveltejs/kit';
import { ChannelType } from 'discord-api-types/v10';
import * as v from 'valibot';

const ConfigSchema = v.object({
	guildId: v.string(),
	// undefined = leave unchanged, null/'' = clear
	custom_channel: v.nullish(v.string()),
	bot_ignored_channels: v.array(v.string()),
});

export const editConfig = command(ConfigSchema, async (config) => {
	const user = throwIfNotLoggedIn();

	const { isAdmin } = await getDiscordAcc(user, config.guildId);

	if (!isAdmin) return error(403, 'Not authorized');

	const guildChannels = await discordApi.getGuildChannels(config.guildId);
	const guildChannelIds = new Set(guildChannels.map((channel) => channel.id));
	const textChannelIds = new Set(
		guildChannels
			.filter(
				(channel) =>
					channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement
			)
			.map((channel) => channel.id)
	);

	const custom_channel =
		config.custom_channel === undefined ? undefined : config.custom_channel || null;

	if (custom_channel && !textChannelIds.has(custom_channel))
		return error(400, 'Events channel must be a text channel in this server');

	if (!config.bot_ignored_channels.every((id) => guildChannelIds.has(id)))
		return error(400, 'Ignored channels must belong to this server');

	await db.config.setConfig(config.guildId, {
		custom_channel,
		bot_ignored_channels: [...new Set(config.bot_ignored_channels)],
	});
});
