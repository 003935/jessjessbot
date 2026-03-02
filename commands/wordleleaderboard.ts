import { isMessageInstance } from '@sapphire/discord.js-utilities';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { db } from '../src/db';
import { winnersTable } from '../src/db/schema';

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

        const guild = await this.container.client.guilds.fetch(process.env.GUILD_ID!);

        const users = await db.select().from(winnersTable);

        const sorted = users.sort((a, b) => b.wins - a.wins);

        if (sorted.length === 0) {
            await interaction.reply({
                content: "No one has won any games yet!",
                withResponse: true,
                //flags: MessageFlags.Ephemeral
            });
            return;
        }

        const firstfive = await Promise.all(
            sorted.slice(0, 5).map(async (u) => {
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