import { ChannelType, Client, Guild, GuildMember, Message, PermissionsBitField } from 'discord.js';
import { db } from '@/db';
import { getEventMaybeSignups, getEventSignups } from '@/modules/events';

export function isUpcomingRequest(input: string): boolean {
	return /\b(?:who(?:'s| is)? playing|who(?:'s| is)? signed up|who joined|anyone playing|upcoming customs|customs tonight|games tonight|who(?:'s| is)? going)\b/iu.test(
		input
	);
}

function londonDate(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/London',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);
	return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
}

function splitMessages(lines: string[], maxLength = 1800): string[] {
	const result: string[] = [];
	for (const line of lines) {
		const last = result.at(-1);
		if (!last || last.length + line.length + 1 > maxLength) result.push(line);
		else result[result.length - 1] = `${last}\n${line}`;
	}
	return result;
}

async function canReadPublicEvent(
	guild: Guild,
	actor: GuildMember,
	channelId: string
): Promise<boolean> {
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (
		!channel ||
		(channel.type !== ChannelType.GuildText &&
			channel.type !== ChannelType.GuildAnnouncement &&
			channel.type !== ChannelType.PublicThread)
	)
		return false;
	const required = [
		PermissionsBitField.Flags.ViewChannel,
		PermissionsBitField.Flags.ReadMessageHistory,
	];
	const bot = await guild.members.fetchMe();
	return Boolean(
		channel.permissionsFor(guild.roles.everyone)?.has(PermissionsBitField.Flags.ViewChannel) &&
		channel.permissionsFor(actor)?.has(required) &&
		channel.permissionsFor(bot)?.has(required)
	);
}

export async function formatUpcomingCustoms(
	guild: Guild,
	client: Client<true>,
	actor: GuildMember,
	tonight = false,
	requesterChannelId?: string
): Promise<string[]> {
	const now = Date.now();
	const today = londonDate(new Date(now));
	const all = (await db.events.getEventsByGuildIds([guild.id]))
		.filter((event) => event.scheduledTime.getTime() > now)
		.filter((event) => !tonight || londonDate(event.scheduledTime) === today)
		.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
	if (requesterChannelId) {
		all.sort(
			(a, b) =>
				Number(b.channelId === requesterChannelId) - Number(a.channelId === requesterChannelId)
		);
	}
	const visible = [];
	for (const event of all) {
		if (await canReadPublicEvent(guild, actor, event.channelId)) visible.push(event);
		if (visible.length >= 10) break;
	}
	if (visible.length === 0)
		return [
			tonight
				? 'No public customs scheduled for tonight yet (╥﹏╥)'
				: 'No upcoming public customs yet (╥﹏╥)',
		];

	const lines = await Promise.all(
		visible.map(async (event) => {
			const label = (event.name || event.gameName).replaceAll('@', '@\u200b');
			const link = `https://discord.com/channels/${event.guildId}/${event.channelId}/${event.messageId}`;
			const groups = await getEventSignups(client, event);
			const maybe = event.teamCount ? [] : await getEventMaybeSignups(client, event.id);
			const names = async (users: { id: string; globalName?: string | null; username: string }[]) =>
				Promise.all(
					users.map(async (user) => {
						const member = await guild.members.fetch(user.id).catch(() => null);
						return (member?.displayName ?? user.globalName ?? user.username).replaceAll(
							'@',
							'@\u200b'
						);
					})
				);
			const attendance: string[] = [];
			for (const { emoji, users } of groups) {
				const groupName = event.teamCount ? `Team ${emoji}` : 'In';
				const displayNames = await names(users);
				if (displayNames.length === 0) attendance.push(`${groupName} (0): no one yet`);
				else
					for (let offset = 0; offset < displayNames.length; offset += 20)
						attendance.push(
							`${groupName} (${users.length})${offset ? ' continued' : ''}: ${displayNames.slice(offset, offset + 20).join(', ')}`
						);
			}
			if (maybe.length) {
				const displayNames = await names(maybe);
				for (let offset = 0; offset < displayNames.length; offset += 20)
					attendance.push(
						`Maybe (${maybe.length})${offset ? ' continued' : ''}: ${displayNames.slice(offset, offset + 20).join(', ')}`
					);
			}
			return [
				`**${label}** · <t:${Math.floor(event.scheduledTime.getTime() / 1000)}:F> · <#${event.channelId}> · [signup](${link})`,
				...attendance,
			];
		})
	);
	return splitMessages([
		`**${tonight ? 'Tonight’s customs' : 'Upcoming customs'}**`,
		...lines.flat(),
	]);
}

export async function answerUpcomingRequest(
	message: Message<true>,
	prompt: string
): Promise<string[] | null> {
	if (!isUpcomingRequest(prompt)) return null;
	const actor = await message.guild.members.fetch(message.author.id);
	return await formatUpcomingCustoms(
		message.guild,
		message.client as Client<true>,
		actor,
		/tonight/u.test(prompt),
		message.channelId
	);
}
