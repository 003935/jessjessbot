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

export async function saveCursor(channel: HallChannel): Promise<void> {
	await db.hall.updateCursor(
		channel.guildId,
		channel.channelId,
		channel.newestSeen,
		channel.oldestBefore,
		channel.backfillComplete
	);
}

export function highestReactionCount(message: Message): number {
	return Math.max(
		0,
		...[...message.reactions.cache.values()].map((reaction) =>
			Math.max(0, reaction.count - (reaction.me ? 1 : 0))
		)
	);
}

export function readableHallPreview(text: string): string {
	return text.replace(
		/https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/\S+/giu,
		(url) =>
			/\.(?:mp4|mov|webm)(?:\?|$)/iu.test(url)
				? '[video]'
				: /\.(?:png|jpe?g|gif|webp)(?:\?|$)/iu.test(url)
					? '[image]'
					: '[attachment]'
	);
}

export function quoteFromHallPreview(preview: string): string | null {
	const tags = preview.match(/<@!?\d+>|<@&\d+>|<#\d+>|(?:^|\s)@[\p{L}\p{N}_.-]+/gu) ?? [];
	const quote = readableHallPreview(preview)
		.replace(/https?:\/\/\S+/giu, ' ')
		.replace(/<@!?\d+>|<@&\d+>|<#\d+>/gu, ' ')
		.replace(/(?:^|\s)@[\p{L}\p{N}_.-]+/gu, ' ')
		.replace(/\[(?:video|image|attachment|no text)\]/giu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
	if (!/[\p{L}\p{N}]/u.test(quote)) return null;
	if (tags.length >= 3 && quote.split(/\s+/u).length < 3) return null;
	return quote;
}

function preview(message: Message): string {
	const text = readableHallPreview(message.content)
		.replace(/[\p{Default_Ignorable_Code_Point}\u115F\u1160\u2800\u3164\uFFA0]/gu, '')
		.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (text) return text;
	const attachments = [...message.attachments.values()];
	if (attachments.some((attachment) => attachment.contentType?.startsWith('video/')))
		return '[video]';
	if (attachments.some((attachment) => attachment.contentType?.startsWith('image/')))
		return '[image]';
	return attachments.length ? '[attachment]' : '[no text]';
}

export async function saveMessage(message: Message): Promise<boolean> {
	if (!message.guildId || message.author.bot) return false;
	return await db.hall.saveMessage({
		guildId: message.guildId,
		channelId: message.channelId,
		messageId: message.id,
		authorId: message.author.id,
		displayName:
			message.member?.displayName ?? message.author.globalName ?? message.author.username,
		preview: preview(message),
		reactions: highestReactionCount(message),
		createdAt: new Date(message.createdTimestamp),
	});
}

export async function removeMessage(channelId: string, messageId: string): Promise<void> {
	await db.hall.removeMessage(channelId, messageId);
}

export async function topMessages(
	guildId: string,
	channelIds: string[],
	authorId?: string,
	since?: Date
) {
	const candidates = await db.hall.getTopMessages(guildId, channelIds, authorId, since);
	return candidates.filter((entry) => quoteFromHallPreview(entry.preview) !== null).slice(0, 10);
}

export async function refreshReaction(
	reaction: MessageReaction | PartialMessageReaction
): Promise<void> {
	const message = reaction.message;
	if (!message.guildId) return;
	const full = await message.fetch(true);
	if (full.partial) return;
	await saveMessage(full);
}
