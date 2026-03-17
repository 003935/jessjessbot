import { Command } from "@sapphire/framework";
import { WinnersTable } from "@/db/wordle";
import { MessageFlags } from "discord.js";

export class WinsCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("wins")
        .setDescription("check your wins")
        .addUserOption((option) =>
          option.setName("user").setDescription("check user wins"),
        ),
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const userID = interaction.user.id;

    const optionuser = interaction.options.getUser("user");

    const user = await WinnersTable.getUser(
      optionuser === null ? userID : optionuser.id,
    );

    if (user === null) {
      await interaction.reply({
        content: `${optionuser === null ? "You have" : optionuser.displayName + " has"} no wins yet!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: `${optionuser === null ? "You have" : optionuser.displayName + " has"} ${user.wins} ${user.wins === 1 ? "Win!" : "Wins!"}`,
      //flags: MessageFlags.Ephemeral
    });
  }
}
