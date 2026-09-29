import { produce } from 'sveltekit-sse';
import { REST, type RequestData } from '@discordjs/rest';
import {
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
	totalChannels: number;
};
type GuildAPIMessage = APIMessage & { member?: { nick?: string | null } };

const rest = new REST().setToken(env.DISCORD_BOT_TOKEN!);

function humanReactionCount(message: APIMessage): number {
	return (message.reactions ?? []).reduce(
		(total, reaction) => total + Math.max(0, reaction.count - (reaction.me ? 1 : 0)),
		0
	);
}

function preview(message: APIMessage): string {
	const text = message.content
		.replace(/[\p{Default_Ignorable_Code_Point}\u115F\u1160\u2800\u3164\uFFA0]/gu, '')
		.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text || (message.attachments.length > 0 ? '[attachment]' : '[no text]');
}

export const POST: RequestHandler = async ({ params, locals }) => {
	const user = throwIfNotLoggedIn(locals);
	const serverId = params.serverId;
	if (!serverId) error(400, 'Server ID is required');
	const { discordID } = await throwIfNotAdmin(user, discordApi.getGuild(serverId));
	const channels = await db.hall.getChannels(serverId, true);
	if (channels.length === 0) error(400, 'Select at least one Hall of Fame channel first');

	return produce(async ({ emit }) => {
		let scanned = 0;
		let imported = 0;
		let channelsCompleted = 0;
		const emitProgress = (isDone: boolean) =>
			emit(
				'message',
				JSON.stringify({
					isDone,
					scanned,
					imported,
					channelsCompleted,
					totalChannels: channels.length,
				} satisfies HallImportMessage)
			);

		try {
			const importChannel = async (channel: (typeof channels)[number]) => {
				let before: string | undefined;
				let reachedPrevious = false;
				let latestMessageId: string | null = null;

				while (!reachedPrevious) {
					const query = new URLSearchParams({ limit: '100' });
					if (before) query.set('before', before);
					const messages = (await rest.get(Routes.channelMessages(channel.channelId), {
						query,
					} satisfies RequestData)) as RESTGetAPIChannelMessagesResult as GuildAPIMessage[];
					if (messages.length === 0) break;
					latestMessageId ??= messages[0]?.id ?? null;

					const candidates: Parameters<typeof db.hall.saveMessages>[0] = [];
					for (const message of messages) {
						if (channel.newestSeen && BigInt(message.id) <= BigInt(channel.newestSeen)) {
							reachedPrevious = true;
							break;
						}
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
					before = messages.at(-1)?.id;
					if (messages.length < 100) break;

					emitProgress(false);
				}

				await db.hall.updateCursor(
					serverId,
					channel.channelId,
					latestMessageId ?? channel.newestSeen,
					channel.oldestBefore,
					true
				);
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

			await db.hall.saveImport(serverId, discordID, scanned, imported);
			emitProgress(true);
		} catch (caught) {
			console.error('Hall of Fame import failed:', caught);
			emit('error', caught instanceof Error ? caught.message : 'Unknown error');
		}
	});
};
