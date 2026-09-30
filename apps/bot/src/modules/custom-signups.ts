import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChannelType,
	PermissionsBitField,
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

export async function handleCustomSignup(interaction: ButtonInteraction): Promise<void> {
	if (!interaction.inCachedGuild()) return;
	const action = interaction.customId.slice('custom:'.length);
	if (action !== 'join' && action !== 'leave' && action !== 'maybe') return;
	const event = await db.events.getByMessage(interaction.guildId, interaction.message.id);
	if (!event || event.channelId !== interaction.channelId) {
		await interaction.reply({ content: 'That signup is no longer available.', ephemeral: true });
		return;
	}
	if (event.scheduledTime.getTime() <= Date.now()) {
		await interaction.reply({ content: 'That custom has already started.', ephemeral: true });
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
		await interaction.reply({ content: 'That signup is no longer available.', ephemeral: true });
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
	const joined = new Set(
		joinedGroups.flatMap((group) => group.users.map((user) => user.id)).filter(Boolean)
	).size;
	const maybe = (await getEventMaybeSignups(interaction.client, event.id)).length;
	const components = interaction.message.components.map(
		(component) => component.toJSON() as ComponentJson
	);
	updateButtonLabels(components, joined, maybe);
	await interaction.update({ components: components as never });
	const response =
		action === 'join'
			? `You’re in — ${joined} joined, ${maybe} maybe.`
			: action === 'maybe'
				? `Marked maybe — ${joined} joined, ${maybe} maybe.`
				: `You’re off the list — ${joined} joined, ${maybe} maybe.`;
	await interaction.followUp({ content: response, ephemeral: true });
}

type ComponentJson = {
	type?: number;
	custom_id?: string;
	label?: string;
	components?: ComponentJson[];
};

function updateButtonLabels(components: ComponentJson[], joined: number, maybe: number): void {
	for (const component of components) {
		if (component.custom_id === 'custom:join') component.label = `Join · ${joined}`;
		if (component.custom_id === 'custom:maybe') component.label = `Maybe · ${maybe}`;
		if (component.components) updateButtonLabels(component.components, joined, maybe);
	}
}
