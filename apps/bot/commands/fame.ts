import { Command } from '@sapphire/framework';
import {
	ChannelType,
	Collection,
	ContainerBuilder,
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
	totalReactions,
	trackedChannels,
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

async function saveQualifyingMessages(messages: Iterable<Message<true>>): Promise<void> {
	const qualifying = [...messages].filter(
		(message) => !message.author.bot && totalReactions(message) > 2
	);
	for (let index = 0; index < qualifying.length; index += 10) {
		await Promise.all(qualifying.slice(index, index + 10).map(saveMessage));
	}
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
			await saveQualifyingMessages(ordered);
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
		await saveQualifyingMessages(batch.values());
		cursor.oldestBefore = batch.last()!.id;
		checked += batch.size;
		remaining -= batch.size;
		if (batch.size < PAGE_SIZE) cursor.backfillComplete = true;
		await saveCursor(cursor);
	}
	return checked;
}

export async function showFame(
	interaction: Command.ChatInputCommandInteraction,
	selectedChannelId?: string,
	selectedUserId?: string
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
		const winners = await topMessages(guildId, visibleChannelIds, selectedUserId);
		const lines = await Promise.all(
			winners.map(async (entry, index) => {
				const preview = escapeMarkdown(entry.preview.slice(0, MAX_PREVIEW));
				const link = `https://discord.com/channels/${guildId}/${entry.channelId}/${entry.messageId}`;
				const channel = channels.find((channel) => channel?.id === entry.channelId);
				const message =
					channel && canRead(channel)
						? await channel.messages.fetch(entry.messageId).catch(() => null)
						: null;
				const emoji = message ? topReactionEmoji(message) : null;
				return `${index + 1}. “${preview}${entry.preview.length > MAX_PREVIEW ? '…' : ''}” - <@${entry.authorId}> · ${entry.reactions}${emoji ? ` ${emoji}` : ' reactions'} · [link](${link})`;
			})
		);
		const filters = [
			selectedChannelId ? `<#${selectedChannelId}>` : null,
			selectedUserId ? `<@${selectedUserId}>` : null,
		]
			.filter(Boolean)
			.join(' · ');
		const heading = filters ? `🏆 Hall of Fame · ${filters}` : '🏆 Server Hall of Fame';
		const status = `${checked} messages checked${incomplete ? ` · ${incomplete} channel${incomplete === 1 ? '' : 's'} still scanning old history, run this command again` : ''}${inaccessible ? ` · ${inaccessible} inaccessible channel${inaccessible === 1 ? '' : 's'}` : ''}`;
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
	} finally {
		activeGuilds.delete(guildId);
	}
}

export class FameCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('fame').setDescription('Show the server hall of fame')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await showFame(interaction);
	}
}
