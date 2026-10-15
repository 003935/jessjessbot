import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChannelType,
	ContainerBuilder,
	MessageFlags,
	PermissionsBitField,
	type Guild,
	type User,
} from 'discord.js';
import { db } from '@/db';
import { getEventMaybeSignups, getEventSignups } from '@/modules/events';

export function signupButtons(joined = 0, maybe = 0) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('custom:join')
			.setLabel(`Join · ${joined}`)
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId('custom:leave')
			.setLabel('Leave')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId('custom:maybe')
			.setLabel(`Maybe · ${maybe}`)
			.setStyle(ButtonStyle.Primary)
	);
}

type SignupCard = {
	title: string;
	timestamp: number;
	roleId: string;
	iconId?: string | null;
	joined?: string[];
	maybe?: string[];
};

function safeText(value: string): string {
	return value.replace(/([\\`*_{}\[\]()#+.!>|~-])/gu, '\\$1').replaceAll('@', '@\u200b');
}

function attendeeLine(label: string, names: string[]): string {
	const shown = names.slice(0, 20).map(safeText);
	return `**${label} (${names.length})**\n${shown.length ? shown.join(' · ') : 'No one yet'}${names.length > shown.length ? ` · and ${names.length - shown.length} more` : ''}`;
}

export function signupCard({
	title,
	timestamp,
	roleId,
	iconId,
	joined = [],
	maybe = [],
}: SignupCard): ContainerBuilder {
	const heading = `## ${safeText(title)}`;
	const schedule = `<@&${roleId}> · <t:${timestamp}:F>`;
	const card = new ContainerBuilder().setAccentColor(0xad66f2);
	if (iconId)
		card.addSectionComponents((section) =>
			section
				.addTextDisplayComponents(
					(text) => text.setContent(heading),
					(text) => text.setContent(schedule)
				)
				.setThumbnailAccessory((thumbnail) =>
					thumbnail.setURL(`https://cdn.discordapp.com/emojis/${iconId}.webp`)
				)
		);
	else
		card.addTextDisplayComponents(
			(text) => text.setContent(heading),
			(text) => text.setContent(schedule)
		);
	return card
		.addTextDisplayComponents((text) => text.setContent(attendeeLine('Joined', joined)))
		.addTextDisplayComponents((text) => text.setContent(attendeeLine('Maybe', maybe)))
		.addActionRowComponents(signupButtons(joined.length, maybe.length));
}

async function displayNames(guild: Guild, users: User[]): Promise<string[]> {
	const names = await Promise.all(
		users.map(async (user) =>
			(await guild.members.fetch(user.id).catch(() => null))?.displayName ??
			user.globalName ??
			user.username
		)
	);
	return names.sort((a, b) => a.localeCompare(b));
}

export async function handleCustomSignup(interaction: ButtonInteraction): Promise<void> {
	if (!interaction.inCachedGuild()) return;
	const action = interaction.customId.slice('custom:'.length);
	if (action !== 'join' && action !== 'leave' && action !== 'maybe') return;
	await interaction.deferUpdate();
	const event = await db.events.getByMessage(interaction.guildId, interaction.message.id);
	if (!event || event.channelId !== interaction.channelId) {
		await interaction.followUp({ content: 'That signup is no longer available.', ephemeral: true });
		return;
	}
	if (event.scheduledTime.getTime() <= Date.now()) {
		await interaction.followUp({ content: 'That custom has already started.', ephemeral: true });
		return;
	}
	const channel = await interaction.guild.channels.fetch(event.channelId).catch(() => null);
	if (
		!channel ||
		(channel.type !== ChannelType.GuildText &&
			channel.type !== ChannelType.GuildAnnouncement &&
			channel.type !== ChannelType.PublicThread) ||
		!channel
			.permissionsFor(interaction.guild.roles.everyone)
			?.has(PermissionsBitField.Flags.ViewChannel)
	) {
		await interaction.followUp({ content: 'That signup is no longer available.', ephemeral: true });
		return;
	}
	if (action === 'leave') await db.events.removeSignup(event.id, interaction.user.id);
	else
		await db.events.setSignup(
			event.id,
			interaction.user.id,
			action === 'join' ? 'JOINED' : 'MAYBE'
		);
	const joinedGroups = await getEventSignups(interaction.client, event);
	const joinedUsers = [...new Map(
		joinedGroups.flatMap((group) => group.users.map((user) => [user.id, user] as const))
	).values()];
	const maybeUsers = await getEventMaybeSignups(interaction.client, event.id);
	const joined = joinedUsers.length;
	const maybe = maybeUsers.length;
	const [game, roleLink, joinedNames, maybeNames] = await Promise.all([
		db.games.get(event.gameName),
		db.game_roles.get_by_guildId_GameName(interaction.guildId, event.gameName),
		displayNames(interaction.guild, joinedUsers),
		displayNames(interaction.guild, maybeUsers),
	]);
	const roleId = roleLink?.roleId ?? interaction.message.mentions.roles.first()?.id;
	if (!roleId) {
		await interaction.followUp({
			content: 'I saved your choice, but I could not update the card because its game role is missing.',
			ephemeral: true,
		});
		return;
	}
	await interaction.editReply({
		content: null,
		embeds: [],
		components: [
			signupCard({
				title: event.name || `${event.gameName} customs`,
				timestamp: Math.floor(event.scheduledTime.getTime() / 1000),
				roleId,
				iconId: game?.icon,
				joined: joinedNames,
				maybe: maybeNames,
			}),
		],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { parse: [] },
	});
	const response =
		action === 'join'
			? `You’re in — ${joined} joined, ${maybe} maybe.`
			: action === 'maybe'
				? `Marked maybe — ${joined} joined, ${maybe} maybe.`
				: `You’re off the list — ${joined} joined, ${maybe} maybe.`;
	await interaction.followUp({ content: response, ephemeral: true });
}
