import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { setGuildListening } from '@/modules/voice/voice-manager';
import { voiceSessionRefusal } from '@/lib/voice-auth';

export class ListenCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('listen')
				.setDescription('Toggle voice conversation listening for this session')
				.addBooleanOption((option) =>
					option
						.setName('enabled')
						.setDescription('Whether I should listen in voice chat')
						.setRequired(true)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({
				content: 'Use this command in a server after I join your voice channel.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const refusal = voiceSessionRefusal(interaction);
		if (refusal) {
			await interaction.reply({ content: refusal, flags: MessageFlags.Ephemeral });
			return;
		}

		const enabled = interaction.options.getBoolean('enabled', true);
		if (!setGuildListening(interaction.guildId, enabled)) {
			await interaction.reply({
				content: 'I need to be in your voice channel first. Use /join, then try /listen again.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.reply({
			content: enabled
				? 'okay, im listening in voice now. use /listen enabled:false to turn it off.'
				: 'okay, i stopped listening and cleared our voice chat history.',
			flags: MessageFlags.Ephemeral,
		});
	}
}
