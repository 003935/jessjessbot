import { Command } from '@sapphire/framework';
import { MessageFlags, type GuildTextBasedChannel } from 'discord.js';
import { createTldr } from '@/modules/tldr-service';

export class TldrCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('tldr')
				.setDescription('Recap this channel, then catch up on new messages for an hour')
				.addNumberOption((option) =>
					option
						.setName('hours')
						.setDescription(
							'Up to 12 hours, including decimals (0.5 = 30 min); follow-ups cover new messages'
						)
						.setMinValue(0.1)
						.setMaxValue(12)
						.setRequired(true)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild || !interaction.channel || !('messages' in interaction.channel)) {
			await interaction.reply({
				content: 'I cannot read message history in this channel.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		const hours = interaction.options.getNumber('hours', true);
		if (hours < 0.1 || hours > 12) {
			await interaction.reply({
				content: 'I can recap between 0.1 and 12 hours at a time.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		try {
			await interaction.deferReply();
			const content = await createTldr(
				interaction.guild,
				interaction.channel as GuildTextBasedChannel,
				hours
			);
			await interaction.editReply({ content, allowedMentions: { parse: [] } });
		} catch (error) {
			this.container.logger.error('TL;DR failed', error);
			await interaction.editReply("wehh i don't know ;-;");
		}
	}
}
