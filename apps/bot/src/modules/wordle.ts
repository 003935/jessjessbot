import { GuildMember, Role, Message } from 'discord.js';
import { WORDLE_BOT_ID, WORDLE_ROLE_ID } from '@/environment';
import { db } from '@/db';
import { Logger } from '@/utils';
import { parse_wordle_message_v2 } from '@repo/discord-api/utils';
import { Score_To_String } from '@repo/database/utils';

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
	if (message.author.id !== WORDLE_BOT_ID) return; // Ignore non-Wordle bot messages

	logger.info(`Message received:\n${message.content.split('\n').join('\n  ')}`);

	const result_message = parse_wordle_message_v2({
		channelId: message.channelId,
		content: message.content,
		messageId: message.id,
		messageTimestamp: new Date(message.createdTimestamp),
		guildId: guild.id,
	});
	if (result_message === null) {
		logger.debug('No valid Wordle result found in the message.');
		return;
	}

	const fetched_members = new Map<string, GuildMember>();

	for (const [key, failed_mention] of result_message.failedMentions.entries()) {
		const users = (
			await guild.members.fetch({
				query: failed_mention.displayName,
			})
		).filter((member) => member.displayName === failed_mention.displayName);
		if (users.size > 1) {
			logger.warn(`Multiple users found for failed mention: ${failed_mention.displayName}`);
			continue;
		}

		const user = users.first();
		if (user) {
			fetched_members.set(user.id, user);
			// Remove failed_mention from result_message.failedMentions
			result_message.failedMentions.delete(key);
			// Add user to result_message.players
			result_message.players.set(user.id, {
				discordId: user.id,
				score: failed_mention.score,
			});
			logger.info(
				`Parsed failed mention: ${failed_mention.displayName} -> ${user.displayName} (@${user.user.tag})`
			);
		} else {
			logger.warn(`No user found for failed mention: ${failed_mention.displayName}`);
		}
	}

	await db.wordle.addWordleResultMessage(result_message);

	const winner_ids = new Set<string>(
		result_message.winningScore !== null
			? result_message.players
					.values()
					.filter((p) => p.score === result_message.winningScore)
					.map((p) => p.discordId)
			: []
	);

	const ids_to_fetch = [...winner_ids].filter((id) => !fetched_members.has(id));

	if (ids_to_fetch.length > 0) {
		const membersMentioned = await guild.members.fetch({
			user: Array.from(ids_to_fetch),
		});
		for (const id of ids_to_fetch) {
			const member = membersMentioned.get(id);
			if (member === undefined) {
				logger.debug(`Failed to fetch user Id: ${id}`);
				continue;
			}
			fetched_members.set(id, member);
		}
	}

	const wordleKingRole = await guild.roles.fetch(WORDLE_ROLE_ID);
	if (wordleKingRole === null) {
		logger.error(`Role with ID ${WORDLE_ROLE_ID} not found in guild ${guild.name}.`);
		return;
	}

	const winners_array = [...winner_ids]
		.map((id) => fetched_members.get(id))
		.filter((member): member is GuildMember => member !== undefined);

	await sync_wordle_role(winners_array, wordleKingRole);

	if (winners_array.length === 0) {
		logger.debug('No winners found.');
		return;
	} else {
		logger.info(`Winners: ${winners_array.map((winner) => winner.displayName).join(', ')}`);
	}

	const winnerMentions = winners_array.map((winner) => `<@${winner.id}>`);
	const winningScore = Score_To_String(result_message.winningScore!);
	try {
		if (winners_array.length === 1) {
			const dbUser = await db.wordle.getUser(winners_array[0]?.id);
			await message.channel.send(
				`Congratulations ${winnerMentions[0]}! You are the new Wordle King! 👑 (Total wins: ${dbUser?.wins ?? 1})`
			);
		} else {
			await message.channel.send(
				`Congratulations ${winnerMentions.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore ?? '?'}/6)`
			);
		}
	} catch (error) {
		logger.error('Failed to send announcement message:', error);
	}
}
