import { DatabaseConnection } from '../connection';
import { MovieCreateInput } from '../generated/prisma/models';

export class MovieTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async addMovie(movie: MovieCreateInput) {
		await this._db.movie.create({
			data: movie,
		});
	}

	async hasMovie(tmdbId: number) {
		const ret = await this._db.movie.findUnique({
			where: { tmdbId },
			select: { tmdbId: true },
		});
		return ret !== null;
	}

	async request(tmdbId: number, dServerId: string, dUserID: string) {
		let request = await this._db.request.findUnique({
			where: { dServerId_dUserID_tmdbId: { dServerId, dUserID, tmdbId } },
		});

		if (request) return false;

		await this._db.request.create({
			data: {
				dServerId,
				dUserID,
				tmdbId,
			},
		});

		return true;
	}

	async removeRequest(tmdbId: number, dServerId: string, dUserID: string) {
		await this._db.request.delete({
			where: {
				dServerId_dUserID_tmdbId: { dServerId, dUserID, tmdbId },
			},
		});
	}

	async deleteServerMovieRequests(tmdbId: number, dServerId: string) {
		const { count } = await this._db.request.deleteMany({
			where: { dServerId, tmdbId },
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

	async getMovie(tmdbId: number) {
		return await this._db.movie.findUnique({
			where: { tmdbId },
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
