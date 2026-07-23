import { Command } from '@sapphire/framework';
import { AutocompleteInteraction, Guild, MessageFlags } from 'discord.js';
import { db } from '@/db';

export class RequestCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, {
			...options,
			preconditions: ['GuildTextOnly'],
			requiredUserPermissions: ['Administrator'],
			requiredClientPermissions: ['SendPolls'],
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('poll')
				.setDescription('Poll a movie')
				.addStringOption((option) =>
					option
						.setName('title')
						.setDescription('Movie Title')
						.setAutocomplete(true)
						.setRequired(true)
				)
		);
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);

		switch (focusedOption.name) {
			case 'title': {
				const movie_list = await db.movie.searchServerMovies(
					interaction.guildId!,
					focusedOption.value
				);

				return await interaction.respond(
					movie_list.map((movie) => ({
						name: `${movie.title} (${movie.year})`,
						value: movie.imdbId,
					}))
				);
			}
			default:
				return await interaction.respond([]);
		}
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!interaction.guildId) {
			await interaction.reply({ content: 'Missing guild context.', ephemeral: true });
			return;
		}

		const imdbId = interaction.options.getString('title', true);

		const movie = await db.movie.getMovie(imdbId);
		if (movie === null)
			return await interaction.editReply({
				content: 'Movie does not exist.',
			});

		if (interaction.channel && interaction.channel.isSendable()) {
			await interaction.channel.send({
				poll: {
					question: { text: `${movie.title} (${movie.year})` },
					allowMultiselect: false,
					answers: [
						{ emoji: '🔥', text: 'good ass movie' },
						{ emoji: '🍿', text: 'good movie' },
						{ emoji: '😐', text: 'movie' },
						{ emoji: '💀', text: 'ass movie' },
						{ emoji: '💩', text: 'ass' },
					],
					duration: 1,
				},
			});

			await interaction.editReply({
				content: 'Created poll successfully',
			});

			await db.movie.deleteServerMovieRequests(imdbId, interaction.guildId);
		} else {
			await interaction.editReply({
				content: 'Failed to create poll',
			});
		}
	}
}
