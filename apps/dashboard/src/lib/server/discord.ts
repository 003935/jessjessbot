import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { DiscordApi } from '@repo/discord-api';
import valkey from './valkey';

let discordApi: DiscordApi;

if (!building) {
	discordApi = await DiscordApi.fromToken(env.DISCORD_BOT_TOKEN, valkey.discordModule);
}

export { discordApi };
