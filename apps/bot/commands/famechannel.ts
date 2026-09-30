import { Command } from '@sapphire/framework';
import { AutocompleteInteraction, PermissionFlagsBits } from 'discord.js';
import { trackedChannels } from '@/modules/hall';
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
				.addStringOption((option) =>
					option
						.setName('channel')
						.setDescription('Hall of Fame channel to show')
						.setAutocomplete(true)
						.setRequired(true)
				)
		);
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const guild = interaction.guild;
		if (!guild) return await interaction.respond([]);
		const query = interaction.options.getFocused().toLowerCase();
		const [channels, member, botMember] = await Promise.all([
			trackedChannels(guild.id),
			guild.members.fetch(interaction.user.id),
			guild.members.me ?? guild.members.fetchMe(),
		]);
		const visible = await Promise.all(
			channels.map(async ({ channelId }) => {
				const channel = await guild.channels.fetch(channelId).catch(() => null);
				if (
					!channel ||
					!channel
						.permissionsFor(member)
						?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]) ||
					!channel
						.permissionsFor(botMember)
						?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])
				)
					return null;
				return { name: channel.name, value: channelId };
			})
		);
		await interaction.respond(
			visible
				.filter((channel): channel is { name: string; value: string } => channel !== null)
				.filter((channel) => channel.name.toLowerCase().includes(query))
				.slice(0, 25)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const channelId = interaction.options.getString('channel', true);
		await showFame(interaction, channelId);
	}
}
