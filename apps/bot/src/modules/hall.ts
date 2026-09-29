import type { Message, MessageReaction, PartialMessageReaction } from 'discord.js';
import { db } from '@/db';

export type HallChannel = {
	guildId: string;
	channelId: string;
	enabled: boolean;
	newestSeen: string | null;
	oldestBefore: string | null;
	backfillComplete: boolean;
};

export async function trackedChannels(guildId: string): Promise<HallChannel[]> {
	return await db.hall.getChannels(guildId, true);
}

export async function isTracked(guildId: string, channelId: string): Promise<boolean> {
	const channels = await db.hall.getChannels(guildId, true);
	return channels.some((channel) => channel.channelId === channelId);
}

export async function trackChannel(guildId: string, channelId: string): Promise<void> {
	await db.hall.setChannelEnabled(guildId, channelId, true);
}

export async function untrackChannel(guildId: string, channelId: string): Promise<void> {
	await db.hall.setChannelEnabled(guildId, channelId, false);
}

export async function saveCursor(channel: HallChannel): Promise<void> {
	await db.hall.updateCursor(
		channel.guildId,
		channel.channelId,
		channel.newestSeen,
		channel.oldestBefore,
		channel.backfillComplete
	);
}

export function totalReactions(message: Message): number {
	return message.reactions.cache.reduce(
		(total, reaction) => total + Math.max(0, reaction.count - (reaction.me ? 1 : 0)),
		0
	);
}

export async function saveMessage(message: Message): Promise<boolean> {
	if (!message.guildId || message.author.bot) return false;
	const visibleText = message.content
		.replace(/[\p{Default_Ignorable_Code_Point}\u115F\u1160\u2800\u3164\uFFA0]/gu, '')
		.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return await db.hall.saveMessage({
		guildId: message.guildId,
		channelId: message.channelId,
		messageId: message.id,
		authorId: message.author.id,
		displayName:
			message.member?.displayName ?? message.author.globalName ?? message.author.username,
		preview: visibleText || (message.attachments.size ? '[attachment]' : '[no text]'),
		reactions: totalReactions(message),
		createdAt: new Date(message.createdTimestamp),
	});
}

export async function removeMessage(channelId: string, messageId: string): Promise<void> {
	await db.hall.removeMessage(channelId, messageId);
}

export async function topMessages(guildId: string, channelIds: string[], authorId?: string) {
	return await db.hall.getTopMessages(guildId, channelIds, authorId);
}

export async function refreshReaction(
	reaction: MessageReaction | PartialMessageReaction
): Promise<void> {
	const message = reaction.message;
	if (!message.guildId || !(await isTracked(message.guildId, message.channelId))) return;
	const full = await message.fetch(true);
	if (full.partial) return;
	await saveMessage(full);
}
