import { DatabaseConnection } from '../connection';
import * as v from 'valibot';
import { Movie } from '../generated/prisma/client';
import { MovieWhereInput } from '../generated/prisma/models';

const OMDB_API_KEY = process.env.OMDB_API_KEY;

const movie_details_schema = v.object({
	imdbID: v.string(),
	imdbRating: v.string(),
	Type: v.string(),
	Title: v.string(),
	Year: v.string(),
	Runtime: v.string(),
	Genre: v.string(),
	Poster: v.string(),
});

async function get_movie(imdbId: string) {
	const ret = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`);
	if (!ret.ok) throw new Error(`Failed to query omdb ${ret.status}`, { cause: await ret.text() });
	const ret_j = await ret.json();
	const details = v.parse(movie_details_schema, ret_j);
	return details;
}

export class MovieTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	private async _getMovie(imdbId: string): Promise<{ movie: Movie }> {
		let movie = await this._db.movie.findUnique({ where: { imdbId } });
		if (movie !== null) return { movie };

		const details = await get_movie(imdbId);

		movie = {
			genre: details.Genre,
			imdbId: details.imdbID,
			imdbRating: parseFloat(details.imdbRating),
			poster: details.Poster,
			runtime: details.Runtime,
			title: details.Title,
			year: parseInt(details.Year),
		} satisfies Movie;

		await this._db.movie.create({
			data: movie,
		});

		return { movie };
	}

	async request(imdbId: string, dServerId: string, dUserID: string) {
		let { movie } = await this._getMovie(imdbId);
		let request = await this._db.request.findUnique({
			where: { dServerId_dUserID_imdbId: { dServerId, dUserID, imdbId } },
		});

		if (request) return { movie, created: false };

		await this._db.request.create({
			data: {
				dServerId,
				dUserID,
				imdbId,
			},
		});

		return { movie, created: true };
	}

	async removeRequest(imdbId: string, dServerId: string, dUserID: string) {
		await this._db.request.delete({
			where: {
				dServerId_dUserID_imdbId: {
					dServerId,
					dUserID,
					imdbId,
				},
			},
		});
	}

	async deleteServerMovieRequests(imdbId: string, dServerId: string) {
		const { count } = await this._db.request.deleteMany({
			where: { dServerId, imdbId },
		});

		return count;
	}

	async searchServerMovies(dServerId: string, query: string, limit: number = 5) {
		return await this._db.movie.findMany({
			where: {
				AND: [
					{ requests: { some: { dServerId } } },
					{ title: { contains: query, mode: 'insensitive' } },
				],
			},
			take: limit,
		});
	}

	async getMovie(imdbId: string) {
		return await this._db.movie.findUnique({
			where: { imdbId },
		});
	}

	async countServerMovies(dServerId: string) {
		return await this._db.movie.count({
			where: { requests: { some: { dServerId } } },
		});
	}

	async getServerMovies(dServerId: string, options?: { offset?: number; limit?: number }) {
		const { offset = 0, limit = 5 } = options ?? {};

		return await this._db.movie.findMany({
			where: { requests: { some: { dServerId } } },
			take: limit,
			skip: offset,
			orderBy: {
				requests: {
					_count: 'desc',
				},
			},
			include: {
				_count: {
					select: {
						requests: {
							where: {
								dServerId,
							},
						},
					},
				},
				requests: {
					where: {
						dServerId,
					},
					select: {
						dUserID: true,
					},
				},
			},
		});
	}
}
