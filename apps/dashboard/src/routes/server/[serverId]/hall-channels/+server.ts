import { json, error, type RequestHandler } from '@sveltejs/kit';
import { ChannelType } from 'discord-api-types/v10';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';
import { throwIfNotAdmin, throwIfNotLoggedIn } from '$lib/server/permission.utils';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	const user = throwIfNotLoggedIn(locals);
	const serverId = params.serverId;
	if (!serverId) error(400, 'Server ID is required');
	await throwIfNotAdmin(user, discordApi.getGuild(serverId));

	const body = (await request.json().catch(() => null)) as { channelIds?: unknown } | null;
	if (
		!body ||
		!Array.isArray(body.channelIds) ||
		!body.channelIds.every((id) => typeof id === 'string')
	)
		error(400, 'channelIds must be an array of channel IDs');

	const guildChannels = await discordApi.getGuildChannels(serverId);
	const allowedIds = new Set(
		guildChannels
			.filter(
				(channel) =>
					channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement
			)
			.map((channel) => channel.id)
	);
	const channelIds = [...new Set(body.channelIds)].filter((id) => allowedIds.has(id));
	await db.hall.setChannels(serverId, channelIds);

	return json({ channelIds });
};
