import { Command } from '@sapphire/framework';
import { showFame } from './fame';

export class FameUserCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('fameuser')
				.setDescription('Show the hall of fame for one person')
				.addUserOption((option) =>
					option.setName('user').setDescription('Person to show').setRequired(true)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user', true);
		await showFame(interaction, undefined, user.id);
	}
}
