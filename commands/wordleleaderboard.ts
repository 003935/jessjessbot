import { Command } from '@sapphire/framework';
import { WinnersTable } from '../src/db/wordle';
import { GUILD_ID } from '../src/environment';

export class KingCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, { ...options });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder.setName('king').setDescription('wordle leaderboard')
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {

        const guild = await this.container.client.guilds.fetch(GUILD_ID);

        const sorted = await WinnersTable.getSortedWinners(5)

        if (sorted.length === 0) {
            await interaction.reply({
                content: "No one has won any games yet!",
                withResponse: true,
                //flags: MessageFlags.Ephemeral
            });
            return;
        }

        const firstfive = await Promise.all(
            sorted.map(async (u) => {
                const user = await guild.members.fetch(u.userID);
                return {
                    name: user?.displayName ?? "undefined",
                    ...u,
                };
            }),
        );

        await interaction.reply({
            content: firstfive
                .map((u, i) => `${i === 0 ? "👑 " : ""} ${u.name} | ${u.wins} Wins`)
                .join("\n"),
            withResponse: true,
            //flags: MessageFlags.Ephemeral
        });
    }
}
