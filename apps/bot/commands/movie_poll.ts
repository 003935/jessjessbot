import { Command } from '@sapphire/framework';
import { AutocompleteInteraction, MessageFlags } from 'discord.js';
import { db } from '@/db';

const MAX_CHOICE_NAME = 100;

// Discord rejects autocomplete choice names over 100 chars; skip the date when it is empty.
function movieChoiceName(title: string, releaseDate: string | null | undefined): string {
	const suffix = releaseDate ? ` (${releaseDate})` : '';
	const room = MAX_CHOICE_NAME - suffix.length;
	const name = title.length > room ? `${title.slice(0, room - 1)}…` : title;
	return `${name}${suffix}`;
}

function pollQuestion(title: string, releaseDate: string): string {
	const year = releaseDate ? new Date(releaseDate).getFullYear() : NaN;
	return Number.isNaN(year) ? title : `${title} (${year})`;
}

export class RequestCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, {
			...options,
			preconditions: ['GuildTextOnly'],
			requiredClientPermissions: ['SendPolls'],
		});
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('poll')
				.setDescription('Poll a movie')
				.addIntegerOption((option) =>
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
						name: movieChoiceName(movie.title, movie.release_date),
						value: movie.tmdbId,
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
			await interaction.editReply({ content: 'Missing guild context.' });
			return;
		}

		const tmdbId = interaction.options.getInteger('title', true);

		const movie = await db.movie.getMovie(tmdbId);
		if (movie === null)
			return await interaction.editReply({
				content: 'Movie does not exist.',
			});

		if (interaction.channel && interaction.channel.isSendable()) {
			await interaction.channel.send({
				poll: {
					question: { text: pollQuestion(movie.title, movie.release_date) },
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

			await db.movie.deleteServerMovieRequests(tmdbId, interaction.guildId);
		} else {
			await interaction.editReply({
				content: 'Failed to create poll',
			});
		}
	}
}
