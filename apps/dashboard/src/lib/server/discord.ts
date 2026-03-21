import { DISCORD_BOT_TOKEN } from '$env/static/private';
import { REST } from 'discord.js';

const discordApi = new REST().setToken(DISCORD_BOT_TOKEN);

export { discordApi };
