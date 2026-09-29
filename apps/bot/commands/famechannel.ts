import { Command } from '@sapphire/framework';
import { ChannelType } from 'discord.js';
import { showFame } from './fame';

export class FameChannelCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('famechannel')
				.setDescription('Show the hall of fame for one channel')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Channel to show')
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						.setRequired(true)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const channel = interaction.options.getChannel('channel', true);
		await showFame(interaction, channel.id);
	}
}
