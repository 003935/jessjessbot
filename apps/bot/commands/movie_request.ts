import { Command } from '@sapphire/framework';
import {
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	MessageFlags,
} from 'discord.js';
import { db } from '@/db';
import { get_movie } from '@/lib/omdb';
import { tmdb } from '@/lib/tmdb';

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
						.addIntegerOption((option) =>
							option
								.setName('title')
								.setDescription('Movie Title')
								.setAutocomplete(true)
								.setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('List movie requests')
				)
		);
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const subcommand = interaction.options.getSubcommand(true);
		const focusedOption = interaction.options.getFocused(true);

		switch (`${subcommand}-${focusedOption.name}`) {
			case 'request-title': {
				const movie_list = await tmdb.search.movies({
					query: focusedOption.value,
				});

				const display = movie_list.results.slice(0, 3);

				return await interaction.respond(
					display.map((movie) => ({
						name: `${movie.title} (${new Date(movie.release_date).getFullYear()})`,
						value: movie.id,
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

		const subcommand = interaction.options.getSubcommand(true);
		switch (subcommand) {
			case 'request': {
				const tmdbId = interaction.options.getInteger('title', true);

				try {
					let movie = await db.movie.getMovie(tmdbId);

					if (!movie) {
						const details = await tmdb.movies.details({
							movie_id: tmdbId,
						});
						let omdb: Awaited<ReturnType<typeof get_movie>> | undefined;
						if (details.imdb_id) omdb = await get_movie(details.imdb_id);

						movie = {
							genres: details.genres.map((g) => g.name).join(', '),
							imdbId: details.imdb_id ?? null,
							imdbRating: omdb ? parseFloat(omdb.imdbRating) : null,
							original_title: details.original_title,
							title: details.title,
							poster_path: details.poster_path ?? null,
							release_date: details.release_date,
							runtime: details.runtime ?? null,
							tmdbId: details.id,
							updatedAt: new Date(),
						};

						await db.movie.addMovie(movie);
					}

					const created = await db.movie.request(tmdbId, interaction.guildId, interaction.user.id);

					if (created)
						return await interaction.editReply({
							components: [
								new ContainerBuilder().addSectionComponents((section) =>
									section
										.setThumbnailAccessory((thumb) =>
											thumb.setURL(`https://image.tmdb.org/t/p/w300${movie.poster_path}`)
										)
										.addTextDisplayComponents((textDisplay) => {
											let desc_items = new Array<string>();
											if (movie.release_date)
												desc_items.push(new Date(movie.release_date).getFullYear().toString());
											if (movie.runtime) desc_items.push(`${movie.runtime}m`);
											if (movie.imdbRating) desc_items.push(`${movie.imdbRating}★`);
											textDisplay.setContent(
												`### ${movie.title}\n${desc_items.join(' | ')}\n\nRequested successfully`
											);
											return textDisplay;
										})
								),
							],
							flags: MessageFlags.IsComponentsV2,
						});
					else
						return await interaction.editReply({
							content: `You have already requested this movie.`,
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
					components: [
						new ContainerBuilder()
							.addTextDisplayComponents((textDisplay) =>
								textDisplay.setContent(
									`### Top ${list.length} most requested movies\n` +
										list
											.map(
												(movie, idx) =>
													`${idx + 1}. ${movie.title} (${new Date(movie.release_date).getFullYear()})`
											)
											.join('\n')
								)
							)
							.addActionRowComponents((idk) =>
								idk.addComponents(
									new ButtonBuilder()
										.setLabel('Full list')
										.setURL(`https://dash.jessawg.space/server/${interaction.guildId}/movies`)
										.setStyle(ButtonStyle.Link)
								)
							),
					],
					flags: MessageFlags.IsComponentsV2,
				});
			}
			default:
				return await interaction.editReply({
					content: 'Invalid subcommand',
				});
		}
	}
}
