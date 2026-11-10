import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { ChannelType, type APIMessage } from 'discord-api-types/v10';
import type { RequestHandler } from './$types';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';
import {
	compactMessage,
	conversationWindows,
	requireReviewToken,
	reviewSince,
	snowflakeAt,
	snowflakeTime,
} from '$lib/server/review';

const MAX_PAGES_PER_CHANNEL = 20;
const MAX_CONVERSATIONS = 400;

// The chat since `since` (default: a week ago) wherever jjb was part of it: her messages,
// what people said to her, and what came straight after. Plus the /i good/bad labels.
export const GET: RequestHandler = async ({ request, params, url }) => {
	requireReviewToken(env.REVIEW_API_TOKEN, request);
	const { guildId } = params;
	const botId = discordApi.botId;
	if (!botId) error(500, 'Bot ID not found');
	const since = reviewSince(url.searchParams.get('since'));
	const until = new Date();

	const config = await db.config.getConfig(guildId);
	const skipped = new Set([
		...(config?.bot_ignored_channels ?? []),
		...(config?.bot_disabled_channels ?? []),
	]);
	const channels = (await discordApi.getGuildChannels(guildId)).filter(
		(channel) =>
			(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) &&
			!skipped.has(channel.id)
	);
	const textIds = new Set(channels.map((channel) => channel.id));
	let threads: Array<{ id: string; name: string }> = [];
	try {
		threads = (await discordApi.getActiveThreads(guildId)).threads
			.filter(
				(thread) => 'parent_id' in thread && thread.parent_id && textIds.has(thread.parent_id)
			)
			.map((thread) => ({ id: thread.id, name: thread.name ?? thread.id }));
	} catch {
		/* No thread access; the channels are enough. */
	}

	const after = snowflakeAt(since);
	const scanned: Array<{
		id: string;
		name: string;
		messages: number;
		jjb: number;
		truncated: boolean;
	}> = [];
	const conversations: Array<{ channel: string; messages: ReturnType<typeof compactMessage>[] }> =
		[];
	const people = new Set<string>();
	let jjbMessages = 0;
	let replyCount = 0;
	let reactionsOnJjb = 0;

	for (const channel of [...channels.map((c) => ({ id: c.id, name: c.name })), ...threads]) {
		const messages: APIMessage[] = [];
		let cursor = after;
		let truncated = false;
		try {
			for (let page = 0; ; page++) {
				if (page === MAX_PAGES_PER_CHANNEL) {
					truncated = true;
					break;
				}
				const batch = await discordApi.getMessagesAfter(channel.id, cursor);
				messages.push(...batch);
				if (batch.length < 100) break;
				cursor = batch.at(-1)!.id;
			}
		} catch {
			continue; // jjb can't read this channel.
		}
		const windows = conversationWindows(messages, botId);
		const jjbIds = new Set(messages.filter((m) => m.author.id === botId).map((m) => m.id));
		jjbMessages += jjbIds.size;
		for (const message of messages) {
			if (jjbIds.has(message.id))
				reactionsOnJjb += (message.reactions ?? []).reduce((sum, r) => sum + r.count, 0);
			else if (
				message.message_reference?.message_id &&
				jjbIds.has(message.message_reference.message_id)
			)
				replyCount++;
		}
		for (const window of windows) {
			for (const message of window) if (!message.author.bot) people.add(message.author.id);
			conversations.push({ channel: channel.name, messages: window.map(compactMessage) });
		}
		scanned.push({
			id: channel.id,
			name: channel.name,
			messages: messages.length,
			jjb: jjbIds.size,
			truncated,
		});
	}

	conversations.sort((a, b) => (a.messages[0]!.id < b.messages[0]!.id ? -1 : 1));
	const labels = await db._db.botReplyLabel.findMany({
		where: { guildId, createdAt: { gte: since } },
		orderBy: { createdAt: 'asc' },
		select: {
			messageId: true,
			rating: true,
			reason: true,
			reply: true,
			prompt: true,
			createdAt: true,
		},
	});

	return json({
		guildId,
		botId,
		since: since.toISOString(),
		until: until.toISOString(),
		stats: {
			jjbMessages,
			repliesToJjb: replyCount,
			reactionsOnJjb,
			peopleInvolved: people.size,
			conversations: conversations.length,
		},
		channels: scanned.filter((channel) => channel.messages > 0),
		// Newest kept when there are too many.
		conversations: conversations.slice(-MAX_CONVERSATIONS),
		conversationsDropped: Math.max(0, conversations.length - MAX_CONVERSATIONS),
		labels: labels.map((label) => ({
			...label,
			at: snowflakeTime(label.messageId).toISOString(),
			createdAt: label.createdAt.toISOString(),
		})),
	});
};
