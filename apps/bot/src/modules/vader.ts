import * as vader from 'vader-sentiment';
import {
	ChannelType,
	Guild,
	GuildMember,
	GuildTextBasedChannel,
	Message,
	PermissionsBitField,
} from 'discord.js';

const MAX_MINUTES = 120;
type UserScore = { userId: string; scoreTotal: number; messages: number };

function visibleText(input: string): string {
	return input
		.replace(/<@!?\d+>|<@&\d+>|<#\d+>/gu, ' ')
		.replace(/https?:\/\/\S+/giu, ' ')
		.replace(/[\u200B-\u200F\u2060\uFEFF]/gu, '')
		.trim();
}

function isPublicReadable(
	channel: GuildTextBasedChannel,
	guild: Guild,
	member: GuildMember
): boolean {
	if (
		channel.type !== ChannelType.GuildText &&
		channel.type !== ChannelType.GuildAnnouncement &&
		channel.type !== ChannelType.PublicThread
	)
		return false;
	const everyoneCanView = channel
		.permissionsFor(guild.roles.everyone)
		?.has(PermissionsBitField.Flags.ViewChannel);
	return Boolean(
		everyoneCanView &&
		channel
			.permissionsFor(member)
			?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory])
	);
}

export function parseVaderMinutes(input: string): number | null {
	const normalized = input.trim().toLocaleLowerCase();
	const match = normalized.match(
		/^(?:(?:run|show|check|do)\s+)?(?:the\s+)?vader(?:\s+(?:for|past|last))?(?:\s+(\d{1,3})\s*(hours?|hrs?|h|minutes?|mins?|m))?\s*$/u
	);
	if (!match) return null;
	if (match[1] === undefined) return -1;
	const amount = Number(match[1]);
	const minutes = match[2]!.startsWith('h') ? amount * 60 : amount;
	return Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_MINUTES ? minutes : -1;
}

export async function runVaderOnChannel(
	channel: GuildTextBasedChannel,
	guild: Guild,
	requester: GuildMember,
	minutes: number
): Promise<string[]> {
	if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES)
		return [`Pick a window between 1 and ${MAX_MINUTES} minutes.`];
	if (!isPublicReadable(channel, guild, requester))
		return ['I can only do that in a public channel you can read.'];
	const permissions = channel.permissionsFor(await guild.members.fetchMe());
	if (
		!permissions?.has([
			PermissionsBitField.Flags.ViewChannel,
			PermissionsBitField.Flags.ReadMessageHistory,
		])
	)
		return ['I need permission to read message history in this channel.'];

	const cutoff = Date.now() - minutes * 60 * 1000;
	const scores = new Map<string, UserScore>();
	let before: string | undefined;
	while (true) {
		const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
		if (page.size === 0) break;
		for (const item of page.values()) {
			if (item.createdTimestamp < cutoff || item.author.bot) continue;
			const text = visibleText(item.content);
			if (!text) continue;
			const result = vader.SentimentIntensityAnalyzer.polarity_scores(text);
			const current = scores.get(item.author.id) ?? {
				userId: item.author.id,
				scoreTotal: 0,
				messages: 0,
			};
			current.scoreTotal += result.compound;
			current.messages++;
			scores.set(item.author.id, current);
		}
		const oldest = page.last();
		if (!oldest || oldest.createdTimestamp < cutoff || page.size < 100) break;
		before = oldest.id;
	}

	const ranked = [...scores.values()]
		.map((score) => ({ ...score, average: score.scoreTotal / score.messages }))
		.sort((a, b) => b.average - a.average || b.messages - a.messages);
	if (ranked.length === 0)
		return [`No one has readable messages in this channel in the past ${minutes}m (╥﹏╥)`];
	const rows = await Promise.all(
		ranked.map(async (score, index) => {
			const member = await guild.members.fetch(score.userId).catch(() => null);
			const name = member?.displayName ?? member?.user.globalName ?? 'Unknown';
			return `${index + 1}. **${name.replaceAll('@', '@\u200b')}** · ${score.average.toFixed(2)} · ${score.messages} message${score.messages === 1 ? '' : 's'}${score.messages < 3 ? ' · small sample' : ''}`;
		})
	);
	const header = `**VADER · #${'name' in channel ? channel.name : 'channel'} · past ${minutes}m**\n*Average compound score from −1 (negative) to +1 (positive). Small samples may be noisy; this is a rough English-text estimate.*`;
	const chunks: string[] = [header];
	for (const row of rows) {
		const last = chunks[chunks.length - 1]!;
		if (last.length + row.length + 1 > 1800) chunks.push(row);
		else chunks[chunks.length - 1] = `${last}\n${row}`;
	}
	return chunks;
}

export async function runVader(
	message: Message<true>,
	minutes: number,
	requester: GuildMember
): Promise<string[]> {
	return await runVaderOnChannel(message.channel, message.guild, requester, minutes);
}
