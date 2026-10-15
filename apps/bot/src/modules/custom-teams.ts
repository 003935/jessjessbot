import {
	ChannelType,
	GuildMember,
	Message,
	PermissionsBitField,
	type Client,
	type User,
} from 'discord.js';
import { db } from '@/db';
import { getEventSignups } from '@/modules/events';

type TeamState = { eventId: number; expiresAt: number };
type TeamConfirmation = {
	eventId: number;
	teams: string[][];
	expiresAt: number;
};
type CustomEvent = NonNullable<Awaited<ReturnType<typeof db.events.getByMessage>>>;

const requests = new Map<string, TeamState>();
const confirmations = new Map<string, TeamConfirmation>();
const REQUEST_TTL_MS = 10 * 60 * 1000;
const CONFIRM_TTL_MS = 5 * 60 * 1000;

function key(message: Message<true>): string {
	return `${message.channelId}:${message.author.id}`;
}

function split(lines: string[], max = 1800): string[] {
	const result: string[] = [];
	for (const line of lines) {
		const last = result.at(-1);
		if (!last || last.length + line.length + 1 > max) result.push(line);
		else result[result.length - 1] = `${last}\n${line}`;
	}
	return result;
}

function isTeamRequest(text: string): boolean {
	return /\b(?:make|create|split|form|randomi[sz]e|sort)\b[\s\S]{0,50}\bteams?\b|\bteams?\b[\s\S]{0,50}\b(?:custom|game|tonight|split)\b/iu.test(
		text
	);
}

function requestedTeamCount(text: string): number | null {
	const match = text.match(/\b([2-9]|10)\s+teams?\b/iu) ?? text.match(/^\s*([2-9]|10)\s*$/u);
	return match ? Number(match[1]) : null;
}

async function visiblePublicEvent(message: Message<true>, event: CustomEvent | null) {
	if (!event || event.guildId !== message.guildId) return false;
	const channel = await message.guild.channels.fetch(event.channelId).catch(() => null);
	if (
		!channel ||
		(channel.type !== ChannelType.GuildText &&
			channel.type !== ChannelType.GuildAnnouncement &&
			channel.type !== ChannelType.PublicThread)
	)
		return false;
	const actor = await message.guild.members.fetch(message.author.id);
	const bot = await message.guild.members.fetchMe();
	const read = [
		PermissionsBitField.Flags.ViewChannel,
		PermissionsBitField.Flags.ReadMessageHistory,
	];
	return Boolean(
		channel
			.permissionsFor(message.guild.roles.everyone)
			?.has(PermissionsBitField.Flags.ViewChannel) &&
		channel.permissionsFor(actor)?.has(read) &&
		channel.permissionsFor(bot)?.has(read) &&
		channel
			.permissionsFor(actor)
			?.has(
				channel.type === ChannelType.PublicThread
					? PermissionsBitField.Flags.SendMessagesInThreads
					: PermissionsBitField.Flags.SendMessages
			) &&
		channel
			.permissionsFor(bot)
			?.has(
				channel.type === ChannelType.PublicThread
					? PermissionsBitField.Flags.SendMessagesInThreads
					: PermissionsBitField.Flags.SendMessages
			)
	);
}

async function findEvent(message: Message<true>, prompt: string) {
	const now = Date.now();
	const events = (await db.events.getEventsByGuildIds([message.guildId]))
		.filter((event) => event.scheduledTime.getTime() > now)
		.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
	const text = prompt.toLocaleLowerCase();
	const named = events.filter((event) =>
		[event.gameName, event.name].some((name) => name && text.includes(name.toLocaleLowerCase()))
	);
	const candidates = named.length
		? named
		: events.filter((event) => event.channelId === message.channelId).length === 1
			? events.filter((event) => event.channelId === message.channelId)
			: events.length === 1
				? events
				: [];
	if (candidates.length !== 1) return null;
	const event = candidates[0]!;
	return (await visiblePublicEvent(message, event)) ? event : null;
}

async function participants(message: Message<true>, event: CustomEvent) {
	const groups = await getEventSignups(message.client as Client<true>, event);
	const users = new Map<string, User>();
	for (const group of groups) for (const user of group.users) users.set(user.id, user);
	const members: GuildMember[] = [];
	for (const user of users.values()) {
		const member = await message.guild.members.fetch(user.id).catch(() => null);
		if (member && !member.user.bot) members.push(member);
	}
	return members;
}

function shuffle<T>(items: T[]): T[] {
	const values = [...items];
	for (let index = values.length - 1; index > 0; index--) {
		const other = Math.floor(Math.random() * (index + 1));
		[values[index], values[other]] = [values[other]!, values[index]!];
	}
	return values;
}

function assign(names: string[], count: number): string[][] {
	const teams = Array.from({ length: count }, () => [] as string[]);
	shuffle(names).forEach((name, index) => teams[index % count]!.push(name));
	return teams;
}

function renderTeams(teams: string[][]): string[] {
	return teams.flatMap((team, index) => [
		`**Team ${index + 1}**`,
		...(team.length ? team.map((name) => `• ${name}`) : ['• (empty)']),
	]);
}

export async function handleTeamMention(
	message: Message<true>,
	prompt: string
): Promise<string[] | null> {
	const id = key(message);
	const now = Date.now();
	const request = requests.get(id);
	if (request && request.expiresAt <= now) requests.delete(id);
	const confirmation = confirmations.get(id);
	if (confirmation && confirmation.expiresAt <= now) confirmations.delete(id);

	if (/^confirm\s+teams?$/iu.test(prompt.trim())) {
		if (!confirmation || confirmation.expiresAt <= now) {
			confirmations.delete(id);
			return ['That team preview expired. Ask me again when you’re ready.'];
		}
		confirmations.delete(id);
		const event = await db.events
			.getEventsByGuildIds([message.guildId])
			.then((items) => items.find((item) => item.id === confirmation.eventId));
		if (
			!event ||
			event.scheduledTime.getTime() <= now ||
			!(await visiblePublicEvent(message, event))
		)
			return ['That custom is no longer available.'];
		const channel = await message.guild.channels.fetch(event.channelId).catch(() => null);
		if (!channel || !('send' in channel)) return ['I can’t post the teams there anymore.'];
		const chunks = split(
			[`**${event.name || event.gameName} · random teams**`, ...renderTeams(confirmation.teams)],
			1900
		);
		for (const chunk of chunks)
			await channel.send({ content: chunk, allowedMentions: { parse: [] } });
		return [`Done, I posted the teams in <#${event.channelId}> (ᵔ◡ᵔ)`];
	}
	if (/^cancel\s+teams?$/iu.test(prompt.trim())) {
		confirmations.delete(id);
		requests.delete(id);
		return ['Okay, cancelled.'];
	}

	const isCountReply = Boolean(
		request && request.expiresAt > now && /^\s*(?:[2-9]|10)(?:\s+teams?)?\s*$/iu.test(prompt)
	);
	if (!isTeamRequest(prompt) && !isCountReply) return null;

	let event: CustomEvent | undefined;
	if (request && request.expiresAt > now && isCountReply) {
		event = (await db.events.getEventsByGuildIds([message.guildId])).find(
			(item) => item.id === request.eventId
		);
	} else {
		event = (await findEvent(message, prompt)) ?? undefined;
	}
	if (!event) {
		const upcoming = (await db.events.getEventsByGuildIds([message.guildId])).filter(
			(item) => item.scheduledTime.getTime() > now
		);
		return [
			upcoming.length === 0
				? 'There aren’t any upcoming customs to split people for.'
				: 'Which custom do you mean? Mention the game or event name.',
		];
	}
	if (!(await visiblePublicEvent(message, event)))
		return ['I can only make teams for a public custom you can access.'];
	const members = await participants(message, event);
	if (members.length < 2) return ['Need at least two confirmed people first (¬_¬)'];

	const count =
		request && request.expiresAt > now && isCountReply
			? requestedTeamCount(prompt)
			: requestedTeamCount(prompt);
	if (!count) {
		requests.set(id, { eventId: event.id, expiresAt: now + REQUEST_TTL_MS });
		return [
			`How many teams for **${event.name || event.gameName}**? Pick 2–${Math.min(10, members.length)}.`,
		];
	}
	requests.delete(id);
	if (count < 2 || count > 10 || count > members.length)
		return [`Pick between 2 and ${Math.min(10, members.length)} teams.`];

	const names = members.map((member) => member.displayName.replaceAll('@', '@\u200b'));
	const teams = assign(names, count);
	confirmations.set(id, { eventId: event.id, teams, expiresAt: now + CONFIRM_TTL_MS });
	return split([
		`Here’s a random split for **${event.name || event.gameName}**. Post these teams in <#${event.channelId}>? Reply **@jessjessbot confirm teams** or **@jessjessbot cancel teams** within five minutes.`,
		...renderTeams(teams),
	]);
}
