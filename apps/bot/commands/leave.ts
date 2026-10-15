import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { voiceEnabled } from '@/environment';
import { leaveGuildVoice } from '@/modules/voice/voice-manager';

export class LeaveCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('leave').setDescription('Leave the voice channel')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!voiceEnabled()) {
			await interaction.reply({ content: 'voice isnt ready yet, soon (¬_¬)', flags: MessageFlags.Ephemeral });
			return;
		}
		if (!interaction.guildId) {
			await interaction.reply({
				content: 'Use this command in a server.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		leaveGuildVoice(interaction.guildId);
		await interaction.reply({ content: 'fine, im leaving (¬_¬)', flags: MessageFlags.Ephemeral });
	}
}
