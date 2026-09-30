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

type HallImportMessage = {
	isDone: boolean;
	scanned: number;
	imported: number;
	channelsCompleted: number;
	channelsSkipped: number;
	totalChannels: number;
};
type GuildAPIMessage = APIMessage & { member?: { nick?: string | null } };

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
	const text = message.content
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
			const importChannel = async (channel: (typeof channels)[number]) => {
				const fetchPage = async (before?: string): Promise<GuildAPIMessage[] | null> => {
					const query = new URLSearchParams({ limit: '100' });
					if (before) query.set('before', before);
					try {
						return (await rest.get(Routes.channelMessages(channel.channelId), {
							query,
						} satisfies RequestData)) as RESTGetAPIChannelMessagesResult as GuildAPIMessage[];
					} catch (caught) {
						if (
							caught instanceof DiscordAPIError &&
							(caught.status === 403 || caught.status === 404)
						)
							return null;
						throw caught;
					}
				};
				const recordMessages = async (messages: GuildAPIMessage[]) => {
					const candidates: Parameters<typeof db.hall.saveMessages>[0] = [];
					for (const message of messages) {
						scanned++;
						if (message.author.bot) continue;
						const reactions = humanReactionCount(message);
						if (reactions <= 2) continue;
						candidates.push({
							guildId: serverId,
							channelId: channel.channelId,
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
				const skipChannel = () => {
					channelsSkipped++;
					channelsCompleted++;
					emitProgress(false);
				};

				let newestSeen = channel.newestSeen;
				if (newestSeen || channel.backfillComplete) {
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

				if (!channel.backfillComplete) {
					let before = channel.oldestBefore ?? newestSeen ?? undefined;
					while (true) {
						const page = await fetchPage(before);
						if (!page) return skipChannel();
						if (page.length === 0) {
							await db.hall.updateCursor(
								serverId,
								channel.channelId,
								newestSeen ?? scanStartedSnowflake,
								before ?? null,
								true
							);
							break;
						}
						newestSeen ??= page[0]!.id;
						const fresh = previousImport
							? page.filter((message) => new Date(message.timestamp) > previousImport.lastImport)
							: page;
						await recordMessages(fresh);
						before = page.at(-1)!.id;
						const complete = fresh.length < page.length || page.length < 100;
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

			if (channelsSkipped === 0) await db.hall.saveImport(serverId, discordID, scanned, imported);
			emitProgress(true);
		} catch (caught) {
			console.error('Hall of Fame import failed:', caught);
			emit('error', caught instanceof Error ? caught.message : 'Unknown error');
		}
	});
};
