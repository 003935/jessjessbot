import { Command } from '@sapphire/framework';
import { formatUpcomingCustoms } from '@/modules/custom-queries';

export class UpcomingCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('upcoming').setDescription('See upcoming customs and who signed up')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) return;
		await interaction.deferReply();
		const actor = await interaction.guild.members.fetch(interaction.user.id);
		const chunks = await formatUpcomingCustoms(
			interaction.guild,
			interaction.client,
			actor,
			false,
			interaction.channelId
		);
		await interaction.editReply({ content: chunks[0], allowedMentions: { parse: [] } });
		for (const chunk of chunks.slice(1))
			await interaction.followUp({ content: chunk, allowedMentions: { parse: [] } });
	}
}
