import { Command } from "@sapphire/framework";
import { MessageFlags } from "discord.js";

export class PingCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName("test").setDescription("test emote"),
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const callbackResponse = await interaction.reply({
      content: `<:master:1481243836478001212>`,
      withResponse: true,
      flags: MessageFlags.Ephemeral,
    });
    const msg = callbackResponse.resource?.message;
  }
}
