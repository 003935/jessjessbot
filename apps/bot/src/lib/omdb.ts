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

export async function get_movie(imdbId: string) {
	const res = await fetch(`http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`, {
		method: 'GET',
		headers: {
			accept: 'application/json',
		},
	});
	if (!res.ok)
		throw new Error('Failed to discover movie', {
			cause: {
				status: res.status,
				statusText: res.statusText,
				body: await res.text(),
			},
		});
	const ret_j = await res.json();
	const details = v.parse(movie_details_schema, ret_j);
	return details;
}
