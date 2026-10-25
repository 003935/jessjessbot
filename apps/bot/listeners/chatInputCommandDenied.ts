import { Events, Listener, type ChatInputCommandDeniedPayload, type UserError } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

// Without this, precondition/cooldown denials leave the interaction unanswered.
export class ChatInputCommandDeniedListener extends Listener<typeof Events.ChatInputCommandDenied> {
	public constructor(context: Listener.LoaderContext, options: Listener.Options) {
		super(context, { ...options, event: Events.ChatInputCommandDenied });
	}

	public override async run(error: UserError, { interaction }: ChatInputCommandDeniedPayload) {
		const content = error.message || 'You cannot use this command here.';
		try {
			if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
			else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
		} catch (replyError) {
			this.container.logger.warn('Could not report command denial', replyError);
		}
	}
}
