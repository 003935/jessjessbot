import { ChannelType, Message, PermissionsBitField } from 'discord.js';
import { db } from '@/db';
import { quoteFromHallPreview, topMessages, trackedChannels } from '@/modules/hall';

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
	if (
		/\b(?:wordle|king)\b/u.test(text) &&
		/\b(?:leaderboard|ranking|rank|top|king|winning)\b/u.test(text)
	) {
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
	if (
		/\b(?:wordle\s+)?wins?\b/u.test(text) &&
		/\b(?:my|mine|i|me|have|how many|check|show)\b/u.test(text)
	) {
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
		return `🏆 **Hall of Fame${month ? ' · past 30 days' : ''}**\n${entries
			.slice(0, 5)
			.map(
				(entry, index) =>
					`${index + 1}. “${clean(quoteFromHallPreview(entry.preview)!)}” — ${clean(entry.displayName)} · ${entry.reactions} top reactions · https://discord.com/channels/${message.guild.id}/${entry.channelId}/${entry.messageId}`
			)
			.join('\n')}`;
	}
	return null;
}
