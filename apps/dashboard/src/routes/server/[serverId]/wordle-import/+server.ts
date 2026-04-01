import { produce } from 'sveltekit-sse';
import { REST, type RequestData } from '@discordjs/rest';
import type { Snowflake } from 'discord-api-types/v10';
import { URLSearchParams } from 'url';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';
import { isGuildAdmin } from '$lib/server/permission.utils';
import { parse_wordle_message_v2 } from '$lib/server/wordle.utils';
import type { WordleImportMessage } from '$lib/components/WordleImport.svelte';

const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);
const WORDLE_BOT_ID = env.WORDLE_BOT_ID;

// Rate limit: 24 hours between imports
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

// Cache for failed mention resolution
const failed_mentions_to_user_id_map = new Map<string, string>();

async function resolve_failed_mentions(
	rest: REST,
	guildId: string,
	failed_mentions: Set<string>
): Promise<{
	userIds: Set<string>;
	failed: Set<string>;
}> {
	const userIds = new Set<string>();
	const failed = new Set<string>();

	for (const failed_mention of failed_mentions) {
		const cached_user_id = failed_mentions_to_user_id_map.get(failed_mention);
		if (cached_user_id !== undefined) {
			userIds.add(cached_user_id);
			continue;
		}

		const users = (await rest.get(`/guilds/${guildId}/members/search`, {
			query: new URLSearchParams({ limit: '5', query: failed_mention }),
		} as RequestData)) as {
			nick: string;
			user: {
				global_name: string;
				username: string;
				id: string;
			};
		}[];

		const filtered_users = users.filter((member) => {
			const nickname = member.nick || member.user.global_name || member.user.username;
			return nickname === failed_mention;
		});

		if (filtered_users.length !== 1) {
			failed.add(failed_mention);
			continue;
		}

		const user = filtered_users[0];
		failed_mentions_to_user_id_map.set(failed_mention, user.user.id);
		userIds.add(user.user.id);
	}

	return { userIds, failed };
}

export const POST: RequestHandler = async ({ params, locals }) => {
	const { serverId } = params;
	const user = locals.user;

	if (!user) {
		error(401, 'Not authenticated');
	}

	if (!serverId) {
		error(400, 'Server ID is required');
	}

	// Check if user is admin
	const guild_promise = discordApi.getGuild(serverId);
	const { isAdmin, discordAccount } = await isGuildAdmin(user, guild_promise);

	if (!isAdmin) {
		error(403, 'You must be a server admin to import Wordle messages');
	}

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
		const unresolved_failed_mentions = new Set<string>();

		// Collect all wins to insert in batch at the end
		type WinInsert = {
			channelId: string;
			discordId: string;
			message_timestamp: Date;
			messageId: string;
			score: '1' | '2' | '3' | '4' | '5' | '6' | 'DNF';
			winner: boolean;
		};
		const wins_to_insert: WinInsert[] = [];

		// serverId is guaranteed to be defined here due to earlier check
		const guildId = serverId!;

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
				} as RequestData)) as {
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
					const parsed = parse_wordle_message_v2(message.content);
					if (parsed === undefined) {
						continue;
					}

					// Process each score tier
					for (const [tries, parsed_line] of Object.entries(parsed)) {
						let userIds = new Set<string>(parsed_line.mentions);

						// Resolve failed mentions (nicknames without @ mentions)
						if (parsed_line.failed_mentions.size > 0) {
							const { userIds: resolved_userIds, failed } = await resolve_failed_mentions(
								rest,
								guildId,
								parsed_line.failed_mentions
							);
							failed.forEach((mention) => unresolved_failed_mentions.add(mention));
							userIds = new Set<string>([...userIds, ...resolved_userIds]);
						}

						// Collect wins for batch insert
						for (const user_id of userIds) {
							wins_to_insert.push({
								channelId: message.channel_id,
								discordId: user_id,
								message_timestamp: new Date(message.timestamp),
								messageId: message.id,
								score: tries === 'X' ? 'DNF' : (tries as '1' | '2' | '3' | '4' | '5' | '6'),
								winner: parsed_line.winners,
							});
						}
					}

					messages_parsed_successfully += 1;
				}

				const { error: emitError } = emit(
					'message',
					JSON.stringify({
						isDone: false,
						processed: messages_parsed_successfully,
						total: expected_total,
					} as WordleImportMessage)
				);
				if (emitError) {
					return;
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

			// Batch insert all wins in a single transaction
			if (wins_to_insert.length > 0) {
				await db.wordle.addWins(wins_to_insert);
			}

			// Record the import in database
			await db.wordleImport.upsertImport(
				guildId,
				discordAccount.accountId,
				messages_parsed_successfully
			);

			emit(
				'message',
				JSON.stringify({
					isDone: true,
					processed: messages_parsed_successfully,
					total: expected_total,
					unresolved_failed_mentions: Array.from(unresolved_failed_mentions),
				} as WordleImportMessage)
			);
		} catch (err) {
			console.error('SSE error:', err);
			emit('error', err instanceof Error ? err.message : 'Unknown error');
		}
	});
};
