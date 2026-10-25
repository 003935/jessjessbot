import { OMDB_API_KEY } from '@/environment';
import * as v from 'valibot';

const movie_details_schema = v.object({
	Title: v.string(),
	Year: v.string(),
	Rated: v.string(),
	Released: v.string(),
	Runtime: v.string(),
	Genre: v.string(),
	Director: v.string(),
	Writer: v.string(),
	Actors: v.string(),
	Plot: v.string(),
	Language: v.string(),
	Country: v.string(),
	Awards: v.string(),
	Poster: v.string(),
	Ratings: v.array(
		v.object({
			Source: v.string(),
			Value: v.string(),
		})
	),
	Metascore: v.string(),
	imdbRating: v.string(),
	imdbVotes: v.string(),
	imdbID: v.string(),
	Type: v.string(),
});

export type OmdbMovie = v.InferOutput<typeof movie_details_schema>;

// OMDb reports "N/A" for unrated titles; normalise anything unparseable to null.
export function parse_imdb_rating(rating: string | undefined): number | null {
	if (!rating) return null;
	const value = parseFloat(rating);
	return Number.isFinite(value) ? value : null;
}

export async function get_movie(imdbId: string): Promise<OmdbMovie | undefined> {
	if (!OMDB_API_KEY) return undefined;
	const params = new URLSearchParams({ apikey: OMDB_API_KEY, i: imdbId });
	const res = await fetch(`https://www.omdbapi.com/?${params}`, {
		method: 'GET',
		headers: {
			accept: 'application/json',
		},
		signal: AbortSignal.timeout(10_000),
	});
	if (!res.ok)
		throw new Error('Failed to discover movie', {
			cause: {
				status: res.status,
				statusText: res.statusText,
				body: await res.text(),
			},
		});
	const ret_j: unknown = await res.json();
	// OMDb answers 200 with { Response: "False", Error } for unknown ids.
	if (typeof ret_j === 'object' && ret_j !== null && 'Response' in ret_j && ret_j.Response === 'False')
		return undefined;
	const details = v.safeParse(movie_details_schema, ret_j);
	return details.success ? details.output : undefined;
}
