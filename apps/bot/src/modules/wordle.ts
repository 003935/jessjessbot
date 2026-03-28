import { GuildMember, Role, Message } from 'discord.js';
import { WORDLE_BOT_ID, GUILD_ID, WORDLE_ROLE_ID, CHANNEL_ID } from '@/environment';
import { Parse_Wordle_Message } from '@/modules/wordle.utils';
import { db } from '@/db';
import { Logger } from '@/utils';

const logger = new Logger('Wordle');

async function sync_wordle_role(winners: Array<GuildMember>, role: Role) {
	const consecutive_winners = new Map<string, GuildMember>(
		winners.filter((winner) => role.members.has(winner.id)).map((member) => [member.id, member])
	);

	const to_remove = Array.from(role.members.values()).filter(
		(member) => !consecutive_winners.has(member.id)
	);
	const to_add = winners.filter((member) => !consecutive_winners.has(member.id));

	if (to_remove.length > 0)
		logger.info(`Removing role from ${to_remove.map((m) => m.displayName).join(', ')}.`);
	if (to_add.length > 0)
		logger.info(`Adding role to ${to_add.map((m) => m.displayName).join(', ')}.`);
	if (consecutive_winners.size > 0)
		logger.info(
			`Keeping role on ${Array.from(consecutive_winners.values())
				.map((m) => m.displayName)
				.join(', ')}.`
		);

	for (const member of to_remove) await member.roles.remove(role);
	for (const member of to_add) await member.roles.add(role);
}

export async function wordle_module(message: Message<boolean>) {
	if (!message.inGuild()) return;
	const guild = message.guild;
	if (guild.id !== GUILD_ID) return; // Ignore other guilds
	if (message.channel.id !== CHANNEL_ID) return; // Only respond in general channel
	if (message.author.id !== WORDLE_BOT_ID) return; // Ignore non-Wordle bot messages

	logger.info(`Message received:\n${message.content.split('\n').join('\n  ')}`);

	const parse_result = Parse_Wordle_Message(message.content);
	if (parse_result === undefined) {
		logger.debug('No valid Wordle result found in the message.');
		return;
	}

	const winners = new Map<string, GuildMember>();
	const ids_to_fetch = new Set<string>();

	for (const parsed_winner_id of parse_result.winner_ids) {
		const mentioned_member = message.mentions.members.get(parsed_winner_id);
		if (mentioned_member !== undefined) winners.set(parsed_winner_id, mentioned_member);
		else ids_to_fetch.add(parsed_winner_id);
	}

	if (ids_to_fetch.size > 0) {
		const membersMentioned = await guild.members.fetch({
			user: Array.from(ids_to_fetch),
		});
		for (const id of ids_to_fetch) {
			const member = membersMentioned.get(id);
			if (member === undefined) {
				logger.debug(`Failed to fetch user Id: ${id}`);
				continue;
			}
			winners.set(id, member);
		}
	}

	if (parse_result.failed_mentions.size > 0) {
		for (const failed_mention of parse_result.failed_mentions) {
			const users = await guild.members.fetch({
				query: failed_mention,
				limit: 1,
			});
			const user = users.filter((member) => member.displayName === failed_mention).first();
			if (user) {
				winners.set(user.id, user);
				logger.info(
					`Parsed failed mention: ${failed_mention} -> ${user.displayName} (@${user.user.tag})`
				);
			} else {
				logger.warn(`No user found for failed mention: ${failed_mention}`);
			}
		}
	}

	const { winningScore } = parse_result;

	const wordleKingRole = await guild.roles.fetch(WORDLE_ROLE_ID);
	if (wordleKingRole === null) {
		logger.error(`Role with ID ${WORDLE_ROLE_ID} not found in guild ${guild.name}.`);
		return;
	}

	const winners_array = Array.from(winners.values());

	await sync_wordle_role(winners_array, wordleKingRole);

	if (winners_array.length === 0) {
		logger.debug('No winners found.');
		return;
	} else {
		logger.info(`Winners: ${winners_array.map((winner) => winner.displayName).join(', ')}`);
	}

	for (const winner of winners_array) {
		try {
			await db.wordle.addWin(winner.id, message.id);
		} catch (error) {
			logger.error(`Failed to record win for ${winner.displayName}:`, error);
		}
	}

	const winnerMentions = winners_array.map((winner) => `<@${winner.id}>`);
	try {
		if (winners_array.length === 1) {
			const dbUser = await db.wordle.getUser(winners_array[0]!.id);
			await message.channel.send(
				`Congratulations ${winnerMentions[0]}! You are the new Wordle King! 👑 (Total wins: ${dbUser?.wins ?? 1})`
			);
		} else {
			await message.channel.send(
				`Congratulations ${winnerMentions.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore}/6)`
			);
		}
	} catch (error) {
		logger.error('Failed to send announcement message:', error);
	}
}
