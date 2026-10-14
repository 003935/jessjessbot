import { produce } from 'sveltekit-sse';
import { DiscordAPIError, REST, type RequestData } from '@discordjs/rest';
import {
	ChannelType,
	Routes,
	type APIMessage,
	type RESTGetAPIChannelMessagesResult,
} from 'discord-api-types/v10';
import { env } from '$env/dynamic/private';
import { error, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';
import { throwIfNotAdmin, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import { hallMessageText } from '@repo/discord-api/utils';

type HallImportMessage = {
	isDone: boolean;
	scanned: number;
	imported: number;
	channelsCompleted: number;
	channelsSkipped: number;
	totalChannels: number;
	/** jjb backfill only: how many jjb messages Discord search found. */
	found?: number;
};
type GuildAPIMessage = APIMessage & { member?: { nick?: string | null } };
type GuildSearchResponse = {
	total_results?: number;
	messages?: GuildAPIMessage[][];
	code?: number;
	retry_after?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rest = new REST().setToken(env.DISCORD_BOT_TOKEN!);

function humanReactionCount(message: APIMessage): number {
	return Math.max(
		0,
		...(message.reactions ?? []).map((reaction) =>
			Math.max(0, reaction.count - (reaction.me ? 1 : 0))
		)
	);
}

function preview(message: APIMessage): string {
	const text = hallMessageText(message)
		.replace(
			/https?:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/\S+/giu,
			(url) =>
				/\.(?:mp4|mov|webm)(?:\?|$)/iu.test(url)
					? '[video]'
					: /\.(?:png|jpe?g|gif|webp)(?:\?|$)/iu.test(url)
						? '[image]'
						: '[attachment]'
		)
		.replace(/[\p{Default_Ignorable_Code_Point}\u115F\u1160\u2800\u3164\uFFA0]/gu, '')
		.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (text) return text;
	if (message.attachments.some((attachment) => attachment.content_type?.startsWith('video/')))
		return '[video]';
	if (message.attachments.some((attachment) => attachment.content_type?.startsWith('image/')))
		return '[image]';
	return message.attachments.length > 0 ? '[attachment]' : '[no text]';
}

export const POST: RequestHandler = async ({ params, locals, url }) => {
	const recheckSaved = url.searchParams.get('recheck') === '1';
	const backfillBot = url.searchParams.get('backfillBot') === '1';
	const user = throwIfNotLoggedIn(locals);
	const serverId = params.serverId;
	if (!serverId) error(400, 'Server ID is required');
	const { discordID } = await throwIfNotAdmin(user, discordApi.getGuild(serverId));
	const guildChannels = await discordApi.getGuildChannels(serverId);
	const channelIds = guildChannels
		.filter(
			(channel) =>
				channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement
		)
		.map((channel) => channel.id);
	if (channelIds.length === 0) error(400, 'This server has no text channels to scan');
	await db.hall.ensureChannels(serverId, channelIds);
	const allowedIds = new Set(channelIds);
	const channels = (await db.hall.getChannels(serverId)).filter((channel) =>
		allowedIds.has(channel.channelId)
	);
	const previousImport = await db.hall.getImport(serverId);
	const scanStartedSnowflake = ((BigInt(Date.now()) - 1420070400000n) << 22n).toString();

	return produce(async ({ emit }) => {
		let scanned = 0;
		let imported = 0;
		let channelsCompleted = 0;
		let channelsSkipped = 0;
		let found: number | undefined;
		const emitProgress = (isDone: boolean) =>
			emit(
				'message',
				JSON.stringify({
					isDone,
					scanned,
					imported,
					channelsCompleted,
					channelsSkipped,
					totalChannels: channels.length,
					...(found === undefined ? {} : { found }),
				} satisfies HallImportMessage)
			);

		try {
			if (recheckSaved) {
				const saved = await db.hall.getSavedMessages(serverId);
				emitProgress(false);
				let next = 0;
				const worker = async () => {
					while (next < saved.length) {
						const entry = saved[next++]!;
						try {
							const message = (await rest.get(
								Routes.channelMessage(entry.channelId, entry.messageId)
							)) as GuildAPIMessage;
							const updated = await db.hall.rescoreMessage(
								serverId,
								entry.channelId,
								entry.messageId,
								humanReactionCount(message),
								preview(message)
							);
							imported += updated.count;
						} catch (caught) {
							if (!(
								caught instanceof DiscordAPIError &&
								(caught.status === 403 || caught.status === 404)
							))
								throw caught;
						}
						scanned++;
						if (scanned % 25 === 0 || scanned === saved.length) emitProgress(false);
					}
				};
				const results = await Promise.allSettled(
					Array.from({ length: Math.min(3, saved.length) }, worker)
				);
				const failed = results.find((result) => result.status === 'rejected');
				if (failed?.status === 'rejected') throw failed.reason;
				channelsCompleted = channels.length;
				emitProgress(true);
				return;
			}
			const fetchChannelPage = async (
				channelId: string,
				query: URLSearchParams
			): Promise<GuildAPIMessage[] | null> => {
				try {
					return (await rest.get(Routes.channelMessages(channelId), {
						query,
					} satisfies RequestData)) as RESTGetAPIChannelMessagesResult as GuildAPIMessage[];
				} catch (caught) {
					if (caught instanceof DiscordAPIError && (caught.status === 403 || caught.status === 404))
						return null;
					throw caught;
				}
			};
			const saveCandidates = async (channelId: string, messages: GuildAPIMessage[]) => {
				const candidates: Parameters<typeof db.hall.saveMessages>[0] = [];
				for (const message of messages) {
					if (
						backfillBot
							? message.author.id !== env.DISCORD_CLIENT_ID
							: message.author.bot && message.author.id !== env.DISCORD_CLIENT_ID
					)
						continue;
					const reactions = humanReactionCount(message);
					if (reactions <= 2) continue;
					candidates.push({
						guildId: serverId,
						channelId,
						messageId: message.id,
						authorId: message.author.id,
						displayName:
							message.member?.nick ?? message.author.global_name ?? message.author.username,
						preview: preview(message),
						reactions,
						createdAt: new Date(message.timestamp),
					});
				}
				imported += await db.hall.saveMessages(candidates);
			};

			// Discord search can filter by author, so the jjb backfill only reads around
			// jjb's own messages instead of every message in the server. Search results
			// omit reactions, so each hit is re-read from channel history to score it.
			const searchBotMessages = async (): Promise<Map<string, string[]> | null> => {
				const byChannel = new Map<string, string[]>();
				const seen = new Set<string>();
				let maxId: string | undefined;
				while (true) {
					const query = new URLSearchParams({
						limit: '25',
						sort_by: 'timestamp',
						sort_order: 'desc',
						include_nsfw: 'true',
					});
					query.append('author_id', env.DISCORD_CLIENT_ID!);
					for (const channelId of channelIds.slice(0, 500)) query.append('channel_id', channelId);
					if (maxId) query.set('max_id', maxId);
					let response: GuildSearchResponse | null = null;
					for (let attempt = 0; attempt < 10; attempt++) {
						try {
							response = (await rest.get(`/guilds/${serverId}/messages/search`, {
								query,
							} satisfies RequestData)) as GuildSearchResponse;
						} catch (caught) {
							// No search access: fall back to reading every channel.
							if (seen.size === 0 && caught instanceof DiscordAPIError) {
								console.warn('Guild message search unavailable, using a full scan:', caught.message);
								return null;
							}
							throw caught;
						}
						// 202 "Index not yet available": wait and retry.
						if (Array.isArray(response.messages)) break;
						await sleep(Math.max(1, response.retry_after ?? 2) * 1000);
						response = null;
					}
					if (!response) throw new Error('Discord search index was not ready; try again in a minute');
					found = Math.max(found ?? 0, response.total_results ?? 0);
					const hits = response.messages!.flat().filter(
						(message) => message.author.id === env.DISCORD_CLIENT_ID && !seen.has(message.id)
					);
					if (hits.length === 0) break;
					for (const message of hits) {
						seen.add(message.id);
						if (!allowedIds.has(message.channel_id)) continue;
						const ids = byChannel.get(message.channel_id) ?? [];
						ids.push(message.id);
						byChannel.set(message.channel_id, ids);
					}
					maxId = hits.reduce((min, message) =>
						BigInt(message.id) < BigInt(min.id) ? message : min
					).id;
					emitProgress(false);
				}
				found = [...byChannel.values()].reduce((sum, ids) => sum + ids.length, 0);
				return byChannel;
			};

			const scoreBotMessages = async (channelId: string, ids: string[]) => {
				const pending = new Set(ids);
				for (const id of ids) {
					if (!pending.has(id)) continue;
					const page = await fetchChannelPage(
						channelId,
						new URLSearchParams({ around: id, limit: '100' })
					);
					if (!page) {
						channelsSkipped++;
						break;
					}
					const fresh = page.filter((message) => pending.delete(message.id));
					await saveCandidates(channelId, fresh);
					// Deleted since search indexed it: don't fetch it again.
					if (pending.delete(id)) scanned++;
					scanned += fresh.length;
					emitProgress(false);
				}
				channelsCompleted++;
				emitProgress(false);
			};

			if (backfillBot) {
				const byChannel = await searchBotMessages();
				if (byChannel) {
					channelsCompleted = channels.length - byChannel.size;
					emitProgress(false);
					let next = 0;
					const entries = [...byChannel];
					const worker = async () => {
						while (next < entries.length) {
							const [channelId, ids] = entries[next++]!;
							await scoreBotMessages(channelId, ids);
						}
					};
					const results = await Promise.allSettled(
						Array.from({ length: Math.min(3, entries.length) }, worker)
					);
					const failed = results.find((result) => result.status === 'rejected');
					if (failed?.status === 'rejected') throw failed.reason;
					emitProgress(true);
					return;
				}
			}

			const importChannel = async (channel: (typeof channels)[number]) => {
				const fetchPage = (before?: string) => {
					const query = new URLSearchParams({ limit: '100' });
					if (before) query.set('before', before);
					return fetchChannelPage(channel.channelId, query);
				};
				const recordMessages = async (messages: GuildAPIMessage[]) => {
					scanned += messages.length;
					await saveCandidates(channel.channelId, messages);
				};
				const skipChannel = () => {
					channelsSkipped++;
					channelsCompleted++;
					emitProgress(false);
				};

				let newestSeen = channel.newestSeen;
				if (!backfillBot && (newestSeen || channel.backfillComplete)) {
					let before: string | undefined;
					let latestNewMessage: string | null = null;
					while (true) {
						const page = await fetchPage(before);
						if (!page) return skipChannel();
						if (page.length === 0) break;
						latestNewMessage ??= page[0]!.id;
						const lastSeen = newestSeen;
						const fresh = lastSeen
							? page.filter((message) => BigInt(message.id) > BigInt(lastSeen))
							: previousImport
								? page.filter((message) => new Date(message.timestamp) > previousImport.lastImport)
								: page;
						await recordMessages(fresh);
						emitProgress(false);
						if (fresh.length < page.length || page.length < 100) break;
						before = page.at(-1)!.id;
					}
					if (!newestSeen || (latestNewMessage && BigInt(latestNewMessage) > BigInt(newestSeen))) {
						newestSeen = latestNewMessage ?? scanStartedSnowflake;
						await db.hall.updateCursor(
							serverId,
							channel.channelId,
							newestSeen,
							channel.oldestBefore,
							channel.backfillComplete
						);
					}
				}

				if (backfillBot || !channel.backfillComplete) {
					let before = backfillBot ? undefined : (channel.oldestBefore ?? newestSeen ?? undefined);
					while (true) {
						const page = await fetchPage(before);
						if (!page) return skipChannel();
						if (page.length === 0) {
							if (!backfillBot)
								await db.hall.updateCursor(
									serverId,
									channel.channelId,
									newestSeen ?? scanStartedSnowflake,
									before ?? null,
									true
								);
							break;
						}
						if (!backfillBot) newestSeen ??= page[0]!.id;
						const fresh =
							!backfillBot && previousImport
								? page.filter((message) => new Date(message.timestamp) > previousImport.lastImport)
								: page;
						await recordMessages(fresh);
						before = page.at(-1)!.id;
						const complete = (!backfillBot && fresh.length < page.length) || page.length < 100;
						if (!backfillBot)
							await db.hall.updateCursor(serverId, channel.channelId, newestSeen, before, complete);
						emitProgress(false);
						if (complete) break;
					}
				}
				channelsCompleted++;
				emitProgress(false);
			};

			let nextChannel = 0;
			const worker = async () => {
				while (nextChannel < channels.length) {
					const channel = channels[nextChannel++]!;
					await importChannel(channel);
				}
			};
			const results = await Promise.allSettled(
				Array.from({ length: Math.min(3, channels.length) }, worker)
			);
			const failed = results.find((result) => result.status === 'rejected');
			if (failed?.status === 'rejected') throw failed.reason;

			if (!backfillBot && channelsSkipped === 0)
				await db.hall.saveImport(serverId, discordID, scanned, imported);
			emitProgress(true);
		} catch (caught) {
			console.error('Hall of Fame import failed:', caught);
			emit('error', caught instanceof Error ? caught.message : 'Unknown error');
		}
	});
};
