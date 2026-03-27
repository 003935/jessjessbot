import { Command } from '@sapphire/framework';
import { ContainerBuilder, MessageFlags } from 'discord.js';
import { db } from '@/db';

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
		const guild = interaction.guild;

		if (guild === null) {
			await interaction.reply({
				content: 'This command can only be used in a guild.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const sorted = await db.wordle.getSortedWinners(5);

		if (sorted.length === 0) {
			await interaction.reply({
				content: 'No one has won any games yet!',
				//flags: MessageFlags.Ephemeral
			});
			return;
		}

		const firstfive = await Promise.all(
			sorted.map(async (u) => {
				const user = await guild.members.fetch(u.id);
				return {
					name: user?.displayName ?? 'undefined',
					...u,
				};
			})
		);

		const king = await guild.members.fetch(firstfive[0]!.id);
		const king_avatar = king.displayAvatarURL() || king.user.displayAvatarURL();

		const container = new ContainerBuilder()
			.setAccentColor(0x51c962)
			.addSectionComponents((section) =>
				section
					.addTextDisplayComponents(
						(textDisplay) => textDisplay.setContent('## 🏅 Wordle Leaderboard' + '\n'),
						(textDisplay) =>
							textDisplay.setContent(
								firstfive
									.map(
										(u, i) =>
											` ${i + 1}. ${i === 0 ? `<@` + u.id + `>` : `<@` + u.id + `>`} : ${u.wins} ${u.wins === 1 ? 'Win' : 'Wins'} `
									)
									.join('\n')
							)
					)
					.setThumbnailAccessory((thumbnail) => thumbnail.setURL(king_avatar))
			);

		await interaction.reply({
			components: [container],
			allowedMentions: { parse: [] },
			flags: MessageFlags.IsComponentsV2,
		});
	}
}
