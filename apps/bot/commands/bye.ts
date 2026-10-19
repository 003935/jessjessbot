import { Command } from '@sapphire/framework';

export class ByeCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('bye').setDescription('Say bye to JessJessBot')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply({ content: 'baibai' });
	}
}
