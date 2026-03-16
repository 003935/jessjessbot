import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

export class PingTestCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, { ...options });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('pingtest')
                .setDescription('Test reaction ping')
                .addStringOption((option) =>
                    option
                        .setName('messageid')
                        .setDescription('Message ID to fetch reactions from')
                        .setRequired(true)
                )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const messageId = interaction.options.getString('messageid', true);

        try {
            const channel = interaction.channel!;
            if (!channel.isSendable()) {
                await interaction.editReply({ content: 'Error: This channel cannot send messages.' });
                return;
            }

            const message = await channel.messages.fetch(messageId);
            const reaction = message.reactions.cache.get('✅');
            const users = await reaction?.users.fetch();

            const mentions = users
                ?.filter((u) => !u.bot)
                .map((u) => `<@${u.id}>`)
                .join(' ');

            if (!mentions) {
                await interaction.editReply({ content: 'No reactions found.' });
                return;
            }

            await interaction.editReply({ content: 'Pinging...' });
            await channel.send({
                content: `Test ping: ${mentions}`,
                allowedMentions: { parse: ['users'] }
            });
        } catch (e) {
            await interaction.editReply({ content: `Error: ${e}` });
        }
    }
}