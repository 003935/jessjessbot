const WORDLE_BOT_ID = process.env.BOT_ID!;
const WORDLE_ROLE_ID = process.env.ROLE_ID!; //FIXME: should be setup in the dashboard, saved in the database for each guild
const BOT_TOKEN = process.env.BOT_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const RIOT_API_KEY = process.env.RIOT_API_KEY!;
const YUM_CHANNEL_ID = process.env.YUM_CHANNEL_ID;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const OMDB_API_KEY = process.env.OMDB_API_KEY!;

if (
	!process.env.BOT_ID ||
	!process.env.ROLE_ID ||
	!process.env.BOT_TOKEN ||
	!process.env.CLIENT_ID ||
	!process.env.RIOT_API_KEY ||
	!process.env.TMDB_API_KEY ||
	!process.env.OMDB_API_KEY
)
	throw new Error('Missing or empty environment variables: Set all required environment variables');

export {
	WORDLE_BOT_ID,
	WORDLE_ROLE_ID,
	BOT_TOKEN,
	CLIENT_ID,
	RIOT_API_KEY,
	YUM_CHANNEL_ID,
	TMDB_API_KEY,
	OMDB_API_KEY,
};
