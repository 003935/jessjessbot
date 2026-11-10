import { Command } from '@sapphire/framework';

export class HiCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('hi').setDescription('Say hi to JessJessBot')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.reply({ content: 'hai' });
	}
}
