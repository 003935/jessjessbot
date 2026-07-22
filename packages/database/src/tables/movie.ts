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

	private async _getMovie(imdbId: string): Promise<{ movie: Movie; new: boolean }> {
		let movie = await this._db.movie.findUnique({ where: { imdbId } });
		if (movie !== null) return { movie, new: false };

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

		return { movie, new: true };
	}

	async request(imdbId: string, dServerId: string, dUserID: string) {
		let { movie, new: newMovie } = await this._getMovie(imdbId);
		let request = await this._db.request.findUnique({
			where: { dServerId_dUserID_imdbId: { dServerId, dUserID, imdbId } },
		});
		let req_count = 0;

		if (!newMovie) req_count = await this._db.request.count({ where: { dServerId, imdbId } });

		if (request) return { movie, created: false, req_count };

		await this._db.request.create({
			data: {
				dServerId,
				dUserID,
				imdbId,
			},
		});

		return { movie, created: true, req_count: req_count + 1 };
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
