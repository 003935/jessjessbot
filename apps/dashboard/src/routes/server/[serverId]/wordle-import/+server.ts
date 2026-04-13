import { produce } from 'sveltekit-sse';
import { REST, type RequestData } from '@discordjs/rest';
import type { Snowflake } from 'discord-api-types/v10';
import { URLSearchParams } from 'url';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { parse_wordle_message_v2 } from '@repo/discord-api/utils';
import { db } from '$lib/server/db';
import { throwIfNotAdmin, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import type { WordleImportMessage } from '$lib/components/WordleImport.svelte';
import type { WordleResultMessage } from '@repo/database/utils';

const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
const WORDLE_BOT_ID = env.WORDLE_BOT_ID;

// Rate limit: 24 hours between imports
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

export const POST: RequestHandler = async ({ params, locals }) => {
	const { serverId } = params;

	const user = throwIfNotLoggedIn(locals);

	if (!serverId) {
		error(400, 'Server ID is required');
	}

	// Check if user is admin
	const guild_promise = discordApi.getGuild(serverId);
	const { discordID } = await throwIfNotAdmin(user, guild_promise);

	// Check rate limit
	const canImport = await db.wordleImport.canImport(serverId, RATE_LIMIT_MS);

	if (!canImport.allowed) {
		const hoursRemaining = Math.ceil((canImport.remainingMs ?? 0) / (1000 * 60 * 60));
		error(429, `Wordle import is on cooldown. Please wait ${hoursRemaining} more hour(s).`);
	}

	return produce(async function start({ emit }) {
		let last_id: Snowflake | undefined;
		let total_messages = 0;
		let messages_parsed_successfully = 0;
		let done = false;
		let expected_total: number | undefined;
		let total_failed_mentions = 0;

		// serverId is guaranteed to be defined here due to earlier check
		const guildId = serverId!;

		const WordleResultMessages: WordleResultMessage[] = [];

		try {
			while (!done) {
				const queryArgs: Record<string, string> = {
					limit: '25',
					content: "Here are yesterday's results:",
					author_id: WORDLE_BOT_ID,
				};
				if (last_id) queryArgs.max_id = last_id;

				const response = (await rest.get(`/guilds/${guildId}/messages/search`, {
					query: new URLSearchParams(queryArgs),
				} satisfies RequestData)) as {
					messages: {
						id: Snowflake;
						content: string;
						author: { id: Snowflake };
						channel_id: Snowflake;
						timestamp: string;
					}[][];
					total_results: number;
				};

				if (!response.messages || response.messages.length === 0) {
					done = true;
					continue;
				}

				// Capture total from first page
				if (expected_total === undefined) {
					expected_total = response.total_results;
				}

				// Process each message
				for (const messagearr of response.messages) {
					const message = messagearr[0];
					if (!message) continue;

					total_messages++;

					// Parse the Wordle message
					const parsed = parse_wordle_message_v2({
						guildId,
						messageId: message.id,
						content: message.content,
						channelId: message.channel_id,
						messageTimestamp: new Date(message.timestamp),
					});

					if (parsed === null) {
						continue;
					}

					total_failed_mentions += parsed.failedMentions.size;

					WordleResultMessages.push(parsed);

					messages_parsed_successfully += 1;

					// Emit progress every 5 messages
					if (messages_parsed_successfully % 5 === 0) {
						const { error: emitError } = emit(
							'message',
							JSON.stringify({
								isDone: false,
								processed: messages_parsed_successfully,
								total: expected_total,
							} satisfies WordleImportMessage)
						);
						if (emitError) {
							return;
						}
					}
				}

				// Get the last matching message for pagination
				const last_message = response.messages[response.messages.length - 1]?.[0];
				if (last_message) {
					last_id = last_message.id;
				}

				// Check if we've received all results
				if (total_messages >= expected_total) {
					done = true;
				}

				// Small delay between pages
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			const result = await db.wordle.addWordleResultMessages(WordleResultMessages);

			// Record the import in database
			await db.wordleImport.upsertImport(guildId, discordID, messages_parsed_successfully);

			emit(
				'message',
				JSON.stringify({
					isDone: true,
					processed: messages_parsed_successfully,
					total: expected_total ?? 0,
					total_failed_mentions,
					succeeded: result.succeeded,
					failed: result.failed,
					skipped: result.alreadyExists,
				} satisfies WordleImportMessage)
			);
		} catch (err) {
			console.error('SSE error:', err);
			emit('error', err instanceof Error ? err.message : 'Unknown error');
		}
	});
};
