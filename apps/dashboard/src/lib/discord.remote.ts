import { query } from '$app/server';
import { discordApi } from '$lib/server/discord';
import { throwIfNotLoggedIn } from './server/permission.utils';

export const getEmojis = query(async () => {
	throwIfNotLoggedIn();

	const emojis = await discordApi.getEmojis();

	return emojis;
});
