import { ChannelType, Message, PermissionsBitField } from 'discord.js';
import { db } from '@/db';
import { quoteFromHallPreview, topMessages, trackedChannels } from '@/modules/hall';
import { isRandomMemberRequest, isWordleLeaderboardRequest, isWordleWinsRequest } from '@/modules/mention-intents';
import { WORDLE_BOT_ID } from '@/environment';

function clean(text: string): string {
	return text
		.replace(/([\\`*_{}\[\]()#+.!>|~-])/gu, '\\$1')
		.replace(/\s+/gu, ' ')
		.slice(0, 100);
}

export async function answerReadRequest(
	message: Message<true>,
	prompt: string
): Promise<string | null> {
	const text = prompt.toLocaleLowerCase();
	const needsWordleContext = /\b(?:leaderboard|ranking|rank|top|king|winning|wins?)\b/u.test(text);
	const referenced = needsWordleContext && message.reference?.messageId
		? await message.fetchReference().catch(() => null)
		: null;
	const replyingToWordle = !!referenced &&
		(referenced.author.id === WORDLE_BOT_ID || /\bwordle\b/iu.test(referenced.content));
	if (isRandomMemberRequest(prompt)) {
		const members = await message.guild.members.fetch().catch(() => null);
		if (!members) return 'i cant load the member list right now';
		const people = [...members.values()].filter((member) => !member.user.bot);
		if (!people.length) return 'i cant find anyone to pick';
		const chosen = people[Math.floor(Math.random() * people.length)]!;
		return `i pick ${clean(chosen.displayName)} (¬_¬)`;
	}
	if (isWordleLeaderboardRequest(prompt, replyingToWordle)) {
		const winners = await db.wordle.getSortedWinners(message.guild.id, 5);
		if (!winners.length) return 'No one has won any Wordle games yet!';
		const lines = await Promise.all(
			winners.map(async (winner, index) => {
				const member = await message.guild.members.fetch(winner.id).catch(() => null);
				const name =
					member?.displayName ??
					(await message.client.users.fetch(winner.id).catch(() => null))?.globalName ??
					'Unknown player';
				return `${index + 1}. ${clean(name)} — ${winner.wins} ${winner.wins === 1 ? 'win' : 'wins'}`;
			})
		);
		return `🏅 **Wordle leaderboard**\n${lines.join('\n')}`;
	}
	if (
		/\b(?:league|lol)\b/u.test(text) &&
		/\b(?:leaderboard|ranking|rank|top|standings)\b/u.test(text)
	) {
		const rows = await db.league.leaderboard();
		if (!rows.length) return 'There are no League accounts added yet.';
		return `🐝 **League leaderboard**\n${rows
			.map((row, index) => {
				const soloq = (
					row.leaguedata as { soloq?: { tier: string; rank: string; lp: number } } | null
				)?.soloq;
				const standing = soloq ? `${soloq.tier} ${soloq.rank} ${soloq.lp} LP` : 'Unranked';
				return `${index + 1}. **${clean(`${row.riotGamename}#${row.riotTagline}`)}** — ${standing}`;
			})
			.join('\n')}`;
	}
	if (isWordleWinsRequest(prompt, replyingToWordle)) {
		const mentioned = message.mentions.users
			.filter((user) => user.id !== message.client.user.id)
			.first();
		const userId = mentioned?.id ?? message.author.id;
		const wins = await db.wordle.getUser(userId);
		const name = mentioned
			? ((await message.guild.members.fetch(userId).catch(() => null))?.displayName ??
				mentioned.globalName ??
				mentioned.username)
			: 'You';
		return `${clean(name)} ${mentioned ? 'has' : 'have'} ${wins?.wins ?? 0} Wordle ${wins?.wins === 1 ? 'win' : 'wins'}!`;
	}
	if (
		/\b(?:hall of fame|fame)\b/u.test(text) &&
		/\b(?:show|see|view|check|top|what|who|hall|fame)\b/u.test(text)
	) {
		const allChannels = await trackedChannels(message.guild.id);
		if (!allChannels.length) return 'No channels are in the hall of fame yet.';
		const actor = await message.guild.members.fetch(message.author.id);
		const bot = await message.guild.members.fetchMe();
		const visible: string[] = [];
		for (const entry of allChannels) {
			const channel = await message.guild.channels.fetch(entry.channelId).catch(() => null);
			if (
				!channel ||
				(channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
			)
				continue;
			const required = [
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.ReadMessageHistory,
			];
			if (
				channel.permissionsFor(actor)?.has(required) &&
				channel.permissionsFor(bot)?.has(required) &&
				channel
					.permissionsFor(message.guild.roles.everyone)
					?.has(PermissionsBitField.Flags.ViewChannel)
			)
				visible.push(channel.id);
		}
		const month = /\b(?:month|monthly|30 days)\b/u.test(text);
		const entries = await topMessages(
			message.guild.id,
			visible,
			undefined,
			month ? new Date(Date.now() - 30 * 86400000) : undefined
		);
		if (!entries.length)
			return 'No reacted messages found in the public hall of fame channels yet.';
		return `🏆 **Fatark Hall of Fame${month ? ' · past 30 days' : ''}**\n${entries
			.slice(0, 5)
			.map(
				(entry, index) =>
					`${index + 1}. “${clean(quoteFromHallPreview(entry.preview)!)}” — ${clean(entry.displayName)} · ${entry.reactions} top reactions · https://discord.com/channels/${message.guild.id}/${entry.channelId}/${entry.messageId}`
			)
			.join('\n')}`;
	}
	return null;
}
