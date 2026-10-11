import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { enqueueGuildSpeech } from '@/modules/voice/voice-manager';

const MAX_SPEECH_TEXT_LENGTH = 1900;

export class SayCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('say')
				.setDescription('Say your exact text in the voice channel')
				.addStringOption((option) =>
					option
						.setName('text')
						.setDescription('The words I should say')
						.setRequired(true)
						.setMaxLength(MAX_SPEECH_TEXT_LENGTH)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({ content: 'Use this command in a server.', flags: MessageFlags.Ephemeral });
			return;
		}

		const text = interaction.options.getString('text', true).trim();
		if (!text) {
			await interaction.reply({ content: 'Give me something to say first.', flags: MessageFlags.Ephemeral });
			return;
		}
		if (text.length > MAX_SPEECH_TEXT_LENGTH) {
			await interaction.reply({ content: 'That line is too long for one voice reply.', flags: MessageFlags.Ephemeral });
			return;
		}

		const sourceChannel = interaction.channel;
		if (!sourceChannel || !enqueueGuildSpeech(interaction.guildId, text, sourceChannel)) {
			await interaction.reply({
				content: 'I’m not in voice right now. Use /join first.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.reply({ content: 'Queued for voice.', flags: MessageFlags.Ephemeral });
	}
}
