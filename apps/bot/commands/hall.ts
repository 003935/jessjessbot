import { Command } from '@sapphire/framework';
import {
	ChannelType,
	Collection,
	MessageFlags,
	PermissionFlagsBits,
	type GuildBasedChannel,
	type Message,
	type NewsChannel,
	type TextChannel,
} from 'discord.js';
import {
	saveCursor,
	saveMessage,
	topMessages,
	trackChannel,
	trackedChannels,
	untrackChannel,
	type HallChannel,
} from '@/modules/hall';

const PAGE_SIZE = 100;
const MAX_PER_CHANNEL = 1_000;
const MAX_PREVIEW = 120;
const activeGuilds = new Set<string>();

function canRead(channel: GuildBasedChannel): channel is TextChannel | NewsChannel {
	return (
		'messages' in channel &&
		(channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
	);
}

function escapeMarkdown(text: string): string {
	return text.replace(/([\\`*_{}\[\]()#+.!>|~-])/g, '\\$1');
}

async function scanChannel(channel: GuildBasedChannel, cursor: HallChannel): Promise<number> {
	if (!canRead(channel)) return 0;
	let checked = 0;
	let remaining = MAX_PER_CHANNEL;
	if (cursor.newestSeen) {
		while (remaining > 0) {
			const batch: Collection<string, Message<true>> = await channel.messages.fetch({
				after: cursor.newestSeen,
				limit: Math.min(PAGE_SIZE, remaining),
			});
			if (batch.size === 0) break;
			const ordered: Message<true>[] = [...batch.values()].sort((a, b) =>
				Number(BigInt(a.id) - BigInt(b.id))
			);
			for (const message of ordered) await saveMessage(message);
			cursor.newestSeen = ordered.at(-1)!.id;
			checked += batch.size;
			remaining -= batch.size;
			await saveCursor(cursor);
			if (batch.size < PAGE_SIZE) break;
		}
	}
	if (!cursor.newestSeen && remaining > 0) {
		const newest = await channel.messages.fetch({ limit: 1 });
		cursor.newestSeen = newest.first()?.id ?? null;
		if (cursor.newestSeen && cursor.backfillComplete) {
			cursor.backfillComplete = false;
			cursor.oldestBefore = null;
		}
		await saveCursor(cursor);
	}
	while (!cursor.backfillComplete && remaining > 0) {
		const batch = await channel.messages.fetch({
			limit: Math.min(PAGE_SIZE, remaining),
			...(cursor.oldestBefore ? { before: cursor.oldestBefore } : {}),
		});
		if (batch.size === 0) {
			cursor.backfillComplete = true;
			await saveCursor(cursor);
			break;
		}
		for (const message of batch.values()) await saveMessage(message);
		cursor.oldestBefore = batch.last()!.id;
		checked += batch.size;
		remaining -= batch.size;
		if (batch.size < PAGE_SIZE) cursor.backfillComplete = true;
		await saveCursor(cursor);
	}
	return checked;
}

export class HallCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('hall')
				.setDescription('Most reacted messages in your chosen channels')
				.addSubcommand((sub) =>
					sub
						.setName('show')
						.setDescription('Show the server hall of fame, or filter to one tracked channel')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Optional channel filter')
								.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						)
						.addUserOption((option) =>
							option.setName('user').setDescription('Optional person filter')
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('track')
						.setDescription('Add a channel to the hall of fame (server managers)')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Channel to add')
								.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
								.setRequired(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('untrack')
						.setDescription('Remove a channel from the hall of fame (server managers)')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Channel to remove')
								.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
								.setRequired(true)
						)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const guild = interaction.guild;
		if (!guild) return;
		const guildId = guild.id;
		const action = interaction.options.getSubcommand();
		const selected = interaction.options.getChannel('channel');
		const selectedUser = interaction.options.getUser('user');
		if (action === 'track' || action === 'untrack') {
			if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
				await interaction.reply({
					content: 'Only server managers can change tracked channels.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			if (!selected) return;
			const selectedChannel = await guild.channels.fetch(selected.id).catch(() => null);
			if (!selectedChannel || !canRead(selectedChannel)) return;
			if (action === 'track') {
				await trackChannel(guildId, selected.id);
				await interaction.reply({
					content: `Okay, I’ll include <#${selected.id}> in the hall of fame. Run /hall show to start scanning its history (˶ᵔ ᵕ ᵔ˶)`,
					allowedMentions: { parse: [] },
				});
			} else {
				await untrackChannel(guildId, selected.id);
				await interaction.reply({
					content: `Removed <#${selected.id}> from the hall of fame.`,
					allowedMentions: { parse: [] },
				});
			}
			return;
		}

		const cursors = (await trackedChannels(guildId)).filter(
			(channel) => !selected || channel.channelId === selected.id
		);
		if (cursors.length === 0) {
			await interaction.reply({
				content: selected
					? 'That channel is not tracked yet. Ask a server manager to use /hall track.'
					: 'No channels are tracked yet. A server manager can add one with /hall track.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		if (activeGuilds.has(guildId)) {
			await interaction.reply({
				content: 'I’m already refreshing the hall of fame. Try again in a moment (˶ᵔ ᵕ ᵔ˶)',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		activeGuilds.add(guildId);
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
			let checked = 0;
			let incomplete = 0;
			let inaccessible = 0;
			const requester = await guild.members.fetch(interaction.user.id);
			const botMember = guild.members.me ?? (await guild.members.fetchMe());
			const visibleChannelIds: string[] = [];
			for (const [index, cursor] of cursors.entries()) {
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
				checked += await scanChannel(channel, cursor);
				if (!cursor.backfillComplete) incomplete++;
			}
			const winners = await topMessages(guildId, visibleChannelIds, selectedUser?.id);
			const lines = winners.map((entry, index) => {
				const preview = escapeMarkdown(entry.preview.slice(0, MAX_PREVIEW));
				const link = `https://discord.com/channels/${guildId}/${entry.channelId}/${entry.messageId}`;
				return `${index + 1}. <@${entry.authorId}> “${preview}${entry.preview.length > MAX_PREVIEW ? '…' : ''}” ${entry.reactions} 🔥 [jump](${link})`;
			});
			const filters = [
				selected ? `<#${selected.id}>` : null,
				selectedUser ? `<@${selectedUser.id}>` : null,
			]
				.filter(Boolean)
				.join(' · ');
			const heading = filters ? `**🏆 Hall of Fame · ${filters}**` : '**🏆 Server Hall of Fame**';
			const status = `${checked} messages checked${incomplete ? ` · ${incomplete} channel${incomplete === 1 ? '' : 's'} still scanning old history, run /hall show again` : ''}${inaccessible ? ` · ${inaccessible} inaccessible channel${inaccessible === 1 ? '' : 's'}` : ''}`;
			await interaction.editReply({
				content: `${heading}\n${lines.length ? lines.join('\n') : 'No reacted messages found yet (｡•́︿•̀｡)'}\n_${status}_`,
				allowedMentions: { parse: [] },
			});
		} catch (error) {
			this.container.logger.error('Hall of Fame failed', error);
			if (interaction.deferred || interaction.replied)
				await interaction.editReply('wehh i could not check the reactions right now ;-;');
			else
				await interaction.reply({
					content: 'wehh i could not check the reactions right now ;-;',
					flags: MessageFlags.Ephemeral,
				});
		} finally {
			activeGuilds.delete(guildId);
		}
	}
}
