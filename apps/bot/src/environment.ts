const WORDLE_BOT_ID = process.env.BOT_ID!;
const WORDLE_ROLE_ID = process.env.ROLE_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const CHANNEL_ID = process.env.CHANNEL_ID!;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const RIOT_API_KEY = process.env.RIOT_API_KEY!;
const YUM_CHANNEL_ID = process.env.YUM_CHANNEL_ID;

if (
	!process.env.BOT_ID ||
	!process.env.ROLE_ID ||
	!process.env.GUILD_ID ||
	!process.env.CHANNEL_ID ||
	!process.env.BOT_TOKEN ||
	!process.env.CLIENT_ID ||
	!process.env.RIOT_API_KEY
)
	throw new Error('Missing or empty environment variables: Set all required environment variables');

export {
	WORDLE_BOT_ID,
	WORDLE_ROLE_ID,
	GUILD_ID,
	CHANNEL_ID,
	BOT_TOKEN,
	CLIENT_ID,
	RIOT_API_KEY,
	YUM_CHANNEL_ID,
};
