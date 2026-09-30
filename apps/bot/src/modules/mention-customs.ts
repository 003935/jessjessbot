import { ChannelType, Message, PermissionsBitField } from 'discord.js';
import { db } from '@/db';
import { signupButtons } from '@/modules/custom-signups';

export type CustomRequest = { game?: unknown; time?: unknown; title?: unknown; channel?: unknown };
export type PreparedCustom = {
	request: CustomRequest;
	confirmation: string;
};

const TIME_ZONE = 'Europe/London';
const MAX_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;
const dateParts = new Intl.DateTimeFormat('en-GB', {
	timeZone: TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
});

function londonParts(date: Date) {
	const parts = Object.fromEntries(
		dateParts.formatToParts(date).map((part) => [part.type, part.value])
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		hour: Number(parts.hour),
		minute: Number(parts.minute),
	};
}

function londonTime(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number
): Date | null {
	let timestamp = Date.UTC(year, month - 1, day, hour, minute);
	for (let attempt = 0; attempt < 3; attempt++) {
		const found = londonParts(new Date(timestamp));
		const delta =
			Date.UTC(year, month - 1, day, hour, minute) -
			Date.UTC(found.year, found.month - 1, found.day, found.hour, found.minute);
		if (delta === 0) return new Date(timestamp);
		timestamp += delta;
	}
	return null;
}

function parseTime(input: string, now = new Date()): Date | null {
	const text = input.trim();
	const inDuration = text.match(
		/^in\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m|hours?|hrs?|hr|h)$/iu
	);
	if (inDuration) {
		const amount = Number(inDuration[1]);
		const unit = inDuration[2]!.toLowerCase();
		const durationMs = amount * (unit.startsWith('h') ? 3_600_000 : 60_000);
		return Number.isFinite(durationMs) && durationMs > 0
			? new Date(now.getTime() + durationMs)
			: null;
	}
	const nextClockTime = text.match(/^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/iu);
	if (nextClockTime) {
		const hour12 = Number(nextClockTime[1]);
		const minute = Number(nextClockTime[2] ?? 0);
		if (hour12 < 1 || hour12 > 12 || minute > 59) return null;
		const hour = (hour12 % 12) + (nextClockTime[3]!.toLowerCase() === 'pm' ? 12 : 0);
		const current = londonParts(now);
		for (let offset = 0; offset <= 1; offset++) {
			const day = new Date(Date.UTC(current.year, current.month - 1, current.day + offset));
			const candidate = londonTime(
				day.getUTCFullYear(),
				day.getUTCMonth() + 1,
				day.getUTCDate(),
				hour,
				minute
			);
			if (candidate && candidate.getTime() > now.getTime() + 10_000) return candidate;
		}
		return null;
	}
	const discord = text.match(/^<t:(\d{9,12})(?::[tTdDfFR])?>$/u);
	if (discord) return new Date(Number(discord[1]) * 1000);
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/u.test(text)) {
		const parsed = new Date(text);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	const relative = text.match(
		/^(today|tonight|tomorrow)(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/iu
	);
	const dated = text.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/iu
	);
	if (!relative && !dated) return null;
	let year: number, month: number, day: number, hour: number, minute: number;
	let meridiem: string | undefined;
	if (relative) {
		const current = londonParts(now);
		const offset = relative[1]!.toLowerCase() === 'tomorrow' ? 1 : 0;
		const next = new Date(Date.UTC(current.year, current.month - 1, current.day + offset));
		year = next.getUTCFullYear();
		month = next.getUTCMonth() + 1;
		day = next.getUTCDate();
		hour = Number(relative[2]);
		minute = Number(relative[3] ?? 0);
		meridiem = relative[4];
	} else {
		year = Number(dated![1]);
		month = Number(dated![2]);
		day = Number(dated![3]);
		hour = Number(dated![4]);
		minute = Number(dated![5] ?? 0);
		meridiem = dated![6];
	}
	if (minute > 59 || hour > (meridiem ? 12 : 23) || hour < (meridiem ? 1 : 0)) return null;
	if (meridiem) hour = (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
	const result = londonTime(year, month, day, hour, minute);
	if (!result) return null;
	const check = londonParts(result);
	return check.year === year && check.month === month && check.day === day ? result : null;
}

function normalize(value: string): string {
	return value.trim().replace(/^#/u, '').replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export async function prepareCustom(
	message: Message<true>,
	request: CustomRequest
): Promise<PreparedCustom | string> {
	if (typeof request.game !== 'string' || typeof request.time !== 'string')
		return 'Please give me a game and time, like “League Custom, tonight at 7pm”. A title is optional.';
	if (
		request.game.length > 100 ||
		request.time.length > 100 ||
		(request.title !== undefined &&
			(typeof request.title !== 'string' || request.title.length > 100)) ||
		(request.channel !== undefined &&
			(typeof request.channel !== 'string' || request.channel.length > 100))
	)
		return 'That game, time, title, or channel is too long.';
	const scheduled = parseTime(request.time, new Date(message.createdTimestamp));
	if (
		!scheduled ||
		scheduled.getTime() <= Date.now() + 10_000 ||
		scheduled.getTime() > Date.now() + MAX_FUTURE_MS
	)
		return 'I could not use that time. Try “in 20 minutes”, “at 2am”, or “tomorrow at 7pm” (UK time).';
	const games = await db.games.getAll();
	if (games.length === 0)
		return 'I can’t see any games in the database this bot uses. Check that this bot and its dashboard use the same DATABASE_URL.';
	const gameName = normalize(request.game);
	const requestedGame = gameName === 'league custom' ? 'league' : gameName;
	const matches = games.filter(
		(game) => normalize(game.name) === requestedGame || normalize(game.name) === gameName
	);
	if (matches.length !== 1)
		return `I could not find that game in the dashboard. Available games: ${games.map((game) => game.name).join(', ')}.`;
	const game = matches[0]!;
	const actor = await message.guild.members.fetch(message.author.id);
	const bot = await message.guild.members.fetchMe();
	const rawChannel = typeof request.channel === 'string' ? request.channel.trim() : undefined;
	const channelId =
		rawChannel?.match(/^<#(\d+)>$/u)?.[1] ??
		(/^\d{17,20}$/u.test(rawChannel ?? '') ? rawChannel : undefined);
	const channels = rawChannel && !channelId ? await message.guild.channels.fetch() : null;
	const normalizedChannel = rawChannel ? normalize(rawChannel) : '';
	const named = channels?.filter(
		(channel) => channel && normalize(channel.name) === normalizedChannel
	);
	if (named && named.size !== 1)
		return 'Please @mention the exact channel where you want the signup.';
	const channel = rawChannel
		? channelId
			? await message.guild.channels.fetch(channelId).catch(() => null)
			: named?.first()
		: message.channel;
	if (
		!channel ||
		(channel.type !== ChannelType.GuildText &&
			channel.type !== ChannelType.GuildAnnouncement &&
			channel.type !== ChannelType.PublicThread)
	)
		return 'I can only post customs in a server text channel or public thread.';
	if (
		!channel
			.permissionsFor(actor)
			?.has([
				PermissionsBitField.Flags.ViewChannel,
				channel.type === ChannelType.PublicThread
					? PermissionsBitField.Flags.SendMessagesInThreads
					: PermissionsBitField.Flags.SendMessages,
			])
	)
		return 'You need permission to post in that channel.';
	if (
		!channel
			.permissionsFor(bot)
			?.has([
				PermissionsBitField.Flags.ViewChannel,
				channel.type === ChannelType.PublicThread
					? PermissionsBitField.Flags.SendMessagesInThreads
					: PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.AddReactions,
			])
	)
		return 'I need permission to post and react in that channel.';
	const linkedRole = await db.game_roles.get_by_guildId_GameName(message.guild.id, game.name);
	const role = linkedRole
		? await message.guild.roles.fetch(linkedRole.roleId).catch(() => null)
		: null;
	if (!linkedRole)
		return `The ${game.name} role needs to be linked to this game in the dashboard before I can ping it.`;
	if (!role) return 'The game role configured in the dashboard no longer exists.';
	if (
		!role.mentionable &&
		!channel.permissionsFor(bot)?.has(PermissionsBitField.Flags.MentionEveryone)
	)
		return `I cannot ping the ${role.name} role in that channel yet.`;
	const title = request.title?.trim() || `${game.name} customs`;
	const timestamp = Math.floor(scheduled.getTime() / 1000);
	return {
		request: {
			game: game.name,
			time: `<t:${timestamp}>`,
			title: request.title?.trim() || undefined,
			channel: channel.id,
		},
		confirmation: `So, is this correct? **${title}** on <t:${timestamp}:F> in <#${channel.id}>. I’ll ping the **${role.name}** role. Reply **@jessjessbot confirm** to post it, or **@jessjessbot cancel**.`,
	};
}

export async function scheduleCustom(
	message: Message<true>,
	request: CustomRequest
): Promise<string> {
	const prepared = await prepareCustom(message, request);
	if (typeof prepared === 'string') return prepared;
	const { game, time, title, channel: channelId } = prepared.request;
	const channel = await message.guild.channels.fetch(channelId as string);
	if (!channel || !('send' in channel)) return 'I cannot post in that channel anymore.';
	const roleLink = await db.game_roles.get_by_guildId_GameName(message.guild.id, game as string);
	if (!roleLink) return 'The linked game role is missing now.';
	const role = await message.guild.roles.fetch(roleLink.roleId).catch(() => null);
	if (!role) return 'The linked game role is missing now.';
	const timestamp = Number((time as string).match(/^<t:(\d+)>$/u)?.[1]);
	if (!Number.isFinite(timestamp)) return 'That time is no longer valid.';
	const sent = await channel.send({
		content: `**${title || `${game} customs`}**\n<@&${role.id}> · <t:${timestamp}:F>\nJoin, leave, or mark maybe below.`,
		components: [signupButtons()],
		allowedMentions: { parse: [], roles: [role.id] },
	});
	try {
		await db.events.insert({
			guildId: message.guild.id,
			channelId: channel.id,
			messageId: sent.id,
			scheduledTime: new Date(timestamp * 1000),
			gameName: game as string,
			name: title as string | undefined,
		});
	} catch (error) {
		await sent.delete().catch(() => undefined);
		throw error;
	}
	return `Done! ${game} customs are up for <t:${timestamp}:F> in <#${channel.id}>. Join, leave, or mark maybe using the buttons: ${sent.url}`;
}
