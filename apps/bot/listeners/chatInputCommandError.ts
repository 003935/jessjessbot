import { Events, Listener, type ChatInputCommandErrorPayload } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

const GENERIC_ERROR = 'wehh something went wrong running that command ;-;';

export class ChatInputCommandErrorListener extends Listener<typeof Events.ChatInputCommandError> {
	public constructor(context: Listener.LoaderContext, options: Listener.Options) {
		super(context, { ...options, event: Events.ChatInputCommandError });
	}

	public override async run(error: unknown, { command, interaction }: ChatInputCommandErrorPayload) {
		this.container.logger.error(`Command /${command.name} failed`, error);
		try {
			if (interaction.deferred || interaction.replied)
				await interaction.editReply({ content: GENERIC_ERROR, embeds: [], components: [] });
			else await interaction.reply({ content: GENERIC_ERROR, flags: MessageFlags.Ephemeral });
		} catch (replyError) {
			this.container.logger.warn(`Could not report /${command.name} failure`, replyError);
		}
	}
}
