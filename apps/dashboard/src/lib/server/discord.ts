import { DISCORD_BOT_TOKEN } from '$env/static/private';
import { REST } from '@discordjs/rest';

const discordApi = new REST().setToken(DISCORD_BOT_TOKEN);

export { discordApi };
