import { Command } from '@sapphire/framework';
import { WinnersTable } from '../src/db/wordle';
import { GUILD_ID } from '../src/environment';
import { MessageFlags } from 'discord.js';

export class WinsCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, { ...options });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('wins').setDescription('check your wins')
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {

        const userID = interaction.user.id

        const user = await WinnersTable.getUser(userID)

        if (user === null) {
            await interaction.reply({
                content: "No wins yet!",
                withResponse: true,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        //You have 0 Wins!
        await interaction.reply({
            content: `You have ${user.wins} ${user.wins === 1 ? "Win!" : "Wins!"}`,
            withResponse: true,
            //flags: MessageFlags.Ephemeral
        });
    }
}
