
const WORDLE_BOT_ID = process.env.BOT_ID!;
const WORDLE_ROLE_ID = process.env.ROLE_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;

if (
  WORDLE_BOT_ID === undefined ||
  WORDLE_ROLE_ID === undefined ||
  GUILD_ID === undefined ||
  BOT_TOKEN === undefined ||
  CLIENT_ID === undefined
)
  throw new Error("Set your environment variables");


export {
  WORDLE_BOT_ID,
  WORDLE_ROLE_ID,
  GUILD_ID,
  BOT_TOKEN,
  CLIENT_ID
}
