import { command } from '$app/server';
import { getDiscordAcc, throwIfNotLoggedIn } from './server/permission.utils';
import { db } from './server/db';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const ConfigSchema = v.object({
	guildId: v.string(),
	custom_channel: v.optional(v.string()),
});

export const editConfig = command(ConfigSchema, async (config) => {
	const user = throwIfNotLoggedIn();

	const { isAdmin } = await getDiscordAcc(user, config.guildId);

	if (!isAdmin) return error(403, 'Not authorized');

	await db.config.setConfig(config.guildId, {
		custom_channel: config.custom_channel,
	});
});
