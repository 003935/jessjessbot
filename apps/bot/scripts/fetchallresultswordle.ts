import { REST, Routes } from 'discord.js';

import { parse_wordle_message_v2 } from '@/modules/wordle.utils';
import { parseArgs } from 'util';
import { exit } from 'process';
import { URLSearchParams } from 'url';
import { db } from '@/db';
import { schema } from '@repo/database';

import { createInterface } from 'readline';
import { InferEnum } from 'drizzle-orm';

const rl = createInterface({ input: process.stdin, output: process.stdout });

const prompt = (question: string): Promise<string> =>
	new Promise((resolve) => rl.question(question, resolve));

type Args = {
	guildId: string;
	channelId: string;
	botToken: string;
	wordleBotId: string;
};

async function args(): Promise<Args> {
	const { values } = parseArgs({
		args: Bun.argv,
		options: {
			channelId: {
				type: 'string',
			},
			botToken: {
				type: 'string',
			},
			guildId: {
				type: 'string',
			},
			wordleBotId: {
				type: 'string',
			},
		},
		strict: true,
		allowPositionals: true,
	});

	const guildId = values.guildId ?? (await prompt('Enter GuildId: '));
	const channelId = values.channelId ?? (await prompt('Enter channelId: '));
	const botToken = values.botToken ?? (await prompt('Enter botToken: '));
	const wordleBotId = values.wordleBotId ?? (await prompt('Enter wordle bot Id: '));

	rl.close();

	return {
		guildId,
		channelId,
		botToken,
		wordleBotId,
	};
}

const failed_mentions_to_user_id_map = new Map<string, string>();

async function resolve_failed_mentions(rest: REST, guildId: string, failed_mentions: Set<string>) {
	const userIds = new Set<string>();

	for (const failed_mention of failed_mentions) {
		const cached_user_id = failed_mentions_to_user_id_map.get(failed_mention);
		if (cached_user_id !== undefined) {
			userIds.add(cached_user_id);
		} else {
			const users = (await rest.get(Routes.guildMembersSearch(guildId), {
				query: new URLSearchParams({ limit: '5', query: failed_mention }),
			})) as {
				nick: string;
				user: {
					global_name: string;
					username: string;
					id: string;
				};
			}[];
			const user = users.filter((member) => {
				const nickname = member.nick || member.user.global_name || member.user.username;
				return nickname === failed_mention;
			})[0];

			if (user) {
				failed_mentions_to_user_id_map.set(failed_mention, user.user.id);
				userIds.add(user.user.id);
			} else {
				console.error(`Failed to resolve failed mention: ${failed_mention}`);
			}
		}
	}
	return userIds;
}

async function main({ botToken, channelId, wordleBotId, guildId }: Args) {
	const rest = new REST().setToken(botToken);

	const limit = 100;

	let fetched = 0;
	let messages_parsed_successfully = 0;

	const urlSearchParams = new URLSearchParams({ limit: limit.toString() });
	while (true) {
		const messages = (await rest.get(Routes.channelMessages(channelId), {
			query: urlSearchParams,
		})) as {
			id: string;
			content: string;
			timestamp: string;
			author: {
				id: string;
			};
		}[];
		fetched += messages.length;
		const userMessages = messages.filter((msg) => msg.author.id === wordleBotId);

		for (const message of userMessages) {
			const parsed = parse_wordle_message_v2(message.content);
			if (parsed === undefined) {
				continue;
			}

			for (const [tries, parsed_line] of Object.entries(parsed)) {
				let userIds = new Set<string>(parsed_line.mentions);

				if (parsed_line.failed_mentions.size > 0) {
					const resolved_userIds = await resolve_failed_mentions(
						rest,
						guildId,
						parsed_line.failed_mentions
					);
					userIds = new Set<string>([...userIds, ...resolved_userIds]);
				}

				for (const user_id of userIds) {
					await db.wordle.addWin({
						channelId: channelId,
						discordId: user_id,
						message_timestamp: new Date(message.timestamp),
						messageId: message.id,
						score: tries === 'X' ? 'DNF' : (tries as InferEnum<typeof schema.scoreEnum>),
						winner: parsed_line.winners,
					});
				}
			}

			messages_parsed_successfully += 1;
		}

		console.log(
			`Messages fetched: ${fetched}, Parsed Successfully ${messages_parsed_successfully}`
		);
		const last_message = messages[messages.length - 1];
		if (last_message === undefined) {
			console.error(`messages.last() is undefined, messages.size: ${messages.length}`);
			exit(1);
		}
		urlSearchParams.set('before', last_message.id);
		if (messages.length < limit) {
			console.log('its joever');
			break;
		}
	}
}

args().then(main);
