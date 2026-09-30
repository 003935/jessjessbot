import { Command } from '@sapphire/framework';
import {
	ChannelType,
	ContainerBuilder,
	MessageFlags,
	PermissionFlagsBits,
	type GuildBasedChannel,
	type Message,
	type NewsChannel,
	type TextChannel,
} from 'discord.js';
import { quoteFromHallPreview, topMessages, trackedChannels } from '@/modules/hall';

const MAX_PREVIEW = 120;

function canRead(channel: GuildBasedChannel): channel is TextChannel | NewsChannel {
	return (
		'messages' in channel &&
		(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
	);
}

function escapeMarkdown(text: string): string {
	return text.replace(/([\\`*_{}\[\]()#+.!>|~-])/g, '\\$1');
}

function topReactionEmoji(message: Message): string | null {
	const top = [...message.reactions.cache.values()]
		.map((reaction) => ({
			count: Math.max(0, reaction.count - (reaction.me ? 1 : 0)),
			emoji: reaction.emoji.toString(),
		}))
		.filter((reaction) => reaction.count > 0)
		.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))[0];
	return top?.emoji ?? null;
}

export async function showFame(
	interaction: Command.ChatInputCommandInteraction,
	selectedChannelId?: string,
	selectedUserId?: string,
	period: 'all' | 'month' = 'all'
) {
	const guild = interaction.guild;
	if (!guild) return;
	const guildId = guild.id;

	const cursors = (await trackedChannels(guildId)).filter(
		(channel) => !selectedChannelId || channel.channelId === selectedChannelId
	);
	if (cursors.length === 0) {
		await interaction.reply({
			content: selectedChannelId
				? 'That channel is not in the hall of fame yet. A server manager can add it in the dashboard.'
				: 'No channels are in the hall of fame yet. A server manager can add some in the dashboard.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}
	try {
		const channels = await Promise.all(
			cursors.map((cursor) => guild.channels.fetch(cursor.channelId).catch(() => null))
		);
		const includesPrivateChannel = channels.some(
			(channel) =>
				channel &&
				!channel.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)
		);
		await interaction.deferReply({
			flags: includesPrivateChannel ? MessageFlags.Ephemeral : undefined,
		});
		let inaccessible = 0;
		const requester = await guild.members.fetch(interaction.user.id);
		const botMember = guild.members.me ?? (await guild.members.fetchMe());
		const visibleChannelIds: string[] = [];
		for (const [index] of cursors.entries()) {
			const channel = channels[index];
			if (
				!channel ||
				!canRead(channel) ||
				!channel
					.permissionsFor(requester)
					?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]) ||
				!channel
					.permissionsFor(botMember)
					?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])
			) {
				inaccessible++;
				continue;
			}
			visibleChannelIds.push(channel.id);
		}
		const since = period === 'month' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : undefined;
		const winners = await topMessages(guildId, visibleChannelIds, selectedUserId, since);
		const lines = await Promise.all(
			winners.map(async (entry, index) => {
				const readable = quoteFromHallPreview(entry.preview)!;
				const preview = escapeMarkdown(readable.slice(0, MAX_PREVIEW));
				const link = `https://discord.com/channels/${guildId}/${entry.channelId}/${entry.messageId}`;
				const channel = channels.find((channel) => channel?.id === entry.channelId);
				const message =
					channel && canRead(channel)
						? await channel.messages.fetch(entry.messageId).catch(() => null)
						: null;
				const emoji = message ? topReactionEmoji(message) : null;
				return `${index + 1}. “${preview}${readable.length > MAX_PREVIEW ? '…' : ''}” - <@${entry.authorId}> · ${entry.reactions}${emoji ? ` ${emoji}` : ' top reactions'} · [link](${link})`;
			})
		);
		const filters = [
			selectedChannelId ? `<#${selectedChannelId}>` : null,
			selectedUserId ? `<@${selectedUserId}>` : null,
		]
			.filter(Boolean)
			.join(' · ');
		const range = period === 'month' ? 'Past 30 days' : 'All time';
		const heading = filters
			? `🏆 Hall of Fame · ${filters} · ${range}`
			: `🏆 Server Hall of Fame · ${range}`;
		const status = `Saved results from ${visibleChannelIds.length} channel${visibleChannelIds.length === 1 ? '' : 's'}${inaccessible ? ` · ${inaccessible} inaccessible channel${inaccessible === 1 ? '' : 's'}` : ''}`;
		const container = new ContainerBuilder()
			.setAccentColor(0xad66f2)
			.addTextDisplayComponents((textDisplay) => textDisplay.setContent(`## ${heading}`))
			.addTextDisplayComponents((textDisplay) =>
				textDisplay.setContent(
					lines.length ? lines.join('\n') : 'No reacted messages found yet (｡•́︿•̀｡)'
				)
			)
			.addTextDisplayComponents((textDisplay) => textDisplay.setContent(`-# ${status}`));
		await interaction.editReply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
	} catch (error) {
		console.error('Hall of Fame failed', error);
		if (interaction.deferred || interaction.replied)
			await interaction.editReply('wehh i could not check the reactions right now ;-;');
		else
			await interaction.reply({
				content: 'wehh i could not check the reactions right now ;-;',
				flags: MessageFlags.Ephemeral,
			});
	}
}

export class FameCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('fame')
				.setDescription('Show the server hall of fame')
				.addStringOption((option) =>
					option
						.setName('period')
						.setDescription('Which messages to include')
						.addChoices({ name: 'All time', value: 'all' }, { name: 'Past month', value: 'month' })
						.setRequired(true)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const period = interaction.options.getString('period', true);
		await showFame(interaction, undefined, undefined, period === 'month' ? 'month' : 'all');
	}
}
