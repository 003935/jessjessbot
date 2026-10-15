import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { voiceEnabled } from '@/environment';
import { joinGuildVoice, VoiceCommandError } from '@/modules/voice/voice-manager';

export class JoinCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('join').setDescription('Join your voice channel and speak summoned replies')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!voiceEnabled()) {
			await interaction.reply({ content: 'voice isnt ready yet, soon (¬_¬)', flags: MessageFlags.Ephemeral });
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			await joinGuildVoice(interaction);
			await interaction.editReply('im here now (¬_¬)');
		} catch (error) {
			const message =
				error instanceof VoiceCommandError
					? error.message
					: 'I could not join that voice channel right now.';
			if (!(error instanceof VoiceCommandError))
				this.container.logger.error('Voice join failed', error instanceof Error ? error.name : 'UnknownError');
			await interaction.editReply(message);
		}
	}
}
