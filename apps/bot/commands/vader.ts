import { Command } from '@sapphire/framework';
import { runVaderOnChannel } from '@/modules/vader';
import { ChannelType } from 'discord.js';

export class VaderCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('vader')
				.setDescription('Rank sentiment in this public channel')
				.addIntegerOption((option) =>
					option
						.setName('minutes')
						.setDescription('How many minutes to analyze (maximum 120)')
						.setRequired(true)
						.setMinValue(1)
						.setMaxValue(120)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) return;
		const channel = interaction.channel;
		if (
			!channel ||
			(channel.type !== ChannelType.GuildText &&
				channel.type !== ChannelType.GuildAnnouncement &&
				channel.type !== ChannelType.PublicThread)
		) {
			await interaction.reply({ content: 'Run this in a public text channel.', ephemeral: true });
			return;
		}
		await interaction.deferReply();
		const member = await interaction.guild.members.fetch(interaction.user.id);
		const minutes = interaction.options.getInteger('minutes', true);
		const chunks = await runVaderOnChannel(channel, interaction.guild, member, minutes);
		await interaction.editReply({ content: chunks[0], allowedMentions: { parse: [] } });
		for (const chunk of chunks.slice(1))
			await interaction.followUp({ content: chunk, allowedMentions: { parse: [] } });
	}
}
