import { Command } from '@sapphire/framework';
import { MessageFlags, PermissionFlagsBits, type Message } from 'discord.js';
import type { BotReplyRating } from '@repo/database';
import { db } from '@/db';

const LINK = /channels\/(\d+)\/(\d+)\/(\d+)/u;
const ID = /^\d{17,20}$/u;

export class LabelCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('i')
				.setDescription("Label one of jjb's replies as good or bad")
				.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
				.addStringOption((option) =>
					option
						.setName('rating')
						.setDescription('Was the reply good or bad?')
						.setRequired(true)
						.addChoices({ name: 'good', value: 'good' }, { name: 'bad', value: 'bad' })
				)
				.addStringOption((option) =>
					option.setName('why').setDescription('What made it good or bad').setMaxLength(1000)
				)
				.addStringOption((option) =>
					option
						.setName('message')
						.setDescription("Message link or ID (defaults to jjb's latest reply here)")
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const reply = (content: string) =>
			interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
		const guild = interaction.guild;
		if (!guild || !interaction.channel || !('messages' in interaction.channel))
			return reply('I cannot read messages in this channel.');
		if (
			interaction.user.id !== guild.ownerId &&
			!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
		)
			return reply('Only the server owner or admins can label replies.');

		const botId = this.container.client.user!.id;
		const target = interaction.options.getString('message')?.trim();
		let message: Message | null | undefined;
		if (target) {
			const link = target.match(LINK);
			if (link && link[1] !== guild.id) return reply('That message is from another server.');
			const messageId = link ? link[3] : ID.test(target) ? target : null;
			if (!messageId) return reply('Give me a message link or ID.');
			const channel = link
				? await guild.channels.fetch(link[2]!).catch(() => null)
				: interaction.channel;
			if (!channel || !('messages' in channel)) return reply('I cannot find that channel.');
			message = await channel.messages.fetch(messageId!).catch(() => null);
			if (!message) return reply('I cannot find that message.');
			if (message.author.id !== botId) return reply("That message isn't one of jjb's.");
		} else {
			const recent = await interaction.channel.messages.fetch({ limit: 50 });
			message = recent.find((candidate) => candidate.author.id === botId);
			if (!message) return reply('jjb has not said anything here lately.');
		}

		const prompt = message.reference?.messageId
			? await message.fetchReference().then(
					(original) => original.content || null,
					() => null
				)
			: null;
		const rating = interaction.options.getString('rating', true) as BotReplyRating;
		const reason = interaction.options.getString('why')?.trim() || null;
		try {
			await db.botReplyLabel.save({
				messageId: message.id,
				guildId: guild.id,
				channelId: message.channelId,
				rating,
				reason,
				reply: message.content,
				prompt,
				labeledById: interaction.user.id,
			});
		} catch (error) {
			this.container.logger.error('Saving reply label failed', error);
			return reply('Saving that label failed.');
		}
		const preview = message.content.replace(/\s+/gu, ' ').slice(0, 80);
		return reply(
			`Labelled **${rating}**${reason ? ` (${reason})` : ''}: [${preview || 'reply'}](${message.url})`
		);
	}
}
