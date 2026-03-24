import { query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { discordApi } from './server/discord';

export const getEmojis = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) return error(401, 'Not logged in');

	const emojis = await discordApi.getEmojis();

	return emojis;
});
