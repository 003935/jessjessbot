import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';
import { db } from '@/db';

export class RequestCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('movie')
				.setDescription('Movie Time')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('request')
						.setDescription('Request a movie')
						.addStringOption((option) =>
							option
								.setName('imdb_id')
								.setDescription('id from the imdb url (e.g.: "tt0080339")')
								.setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('List movie requests')
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!interaction.guildId) {
			await interaction.reply({ content: 'Missing guild context.', ephemeral: true });
			return;
		}

		const subcommand = interaction.options.getSubcommand(true);
		switch (subcommand) {
			case 'request': {
				const imdbId = interaction.options.getString('imdb_id', true);

				try {
					const { movie, created, req_count } = await db.movie.request(
						imdbId,
						interaction.guildId,
						interaction.user.id
					);

					return await interaction.editReply({
						content: `${created ? 'Added request for' : 'You already requested the'} movie: ${movie.title} (${movie.year})\nThere ${req_count !== 1 ? 'are' : 'is'} ${req_count} request${req_count !== 1 ? 's' : ''} for this movie.`,
					});
				} catch (e) {
					console.error(e);
					return await interaction.editReply({
						content: 'Failed to request movie.',
					});
				}
			}
			case 'list': {
				const list = await db.movie.getServerMovies(interaction.guildId);
				return await interaction.editReply({
					content: list
						.map((movie) => `${movie._count.requests} | ${movie.title} (${movie.year})`)
						.join('\n'),
				});
			}
			default:
				return await interaction.editReply({
					content: 'Invalid subcommand',
				});
		}
	}
}
