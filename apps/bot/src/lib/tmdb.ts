import { TMDB_API_KEY } from '@/environment';
import { TMDB } from '@lorenzopant/tmdb';

export const tmdb = new TMDB(TMDB_API_KEY, {
	language: 'en-US',
	region: 'US',
});
