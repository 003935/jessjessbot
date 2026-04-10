import * as v from 'valibot';
import { query, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import { isGuildAdmin, isLoggedIn } from '$lib/server/permission.utils';
import { discordApi } from '$lib/server/discord';

export const getFailedMentions = query(v.string(), async (guildId) => {
	const { locals } = getRequestEvent();

	const user = isLoggedIn(locals);

	await isGuildAdmin(user, guildId);

	return await db.failedMentions.getFailedMentionByGuildId(guildId);
});

const hideFailedMention_Schema = v.object({
	mentionId: v.number(),
	guildId: v.string(),
});

export const hideFailedMention = command(
	hideFailedMention_Schema,
	async ({ mentionId, guildId }) => {
		const { locals } = getRequestEvent();

		if (!locals.user) error(401, 'Not logged in');

		await isGuildAdmin(locals.user, guildId);

		await db.failedMentions.hide(mentionId, locals.user.id);

		return { success: true };
	}
);

const identifyFailedMention_Schema = v.object({
	mentionId: v.number(),
	guildId: v.string(),
	userId: v.string(),
});

export const identifyFailedMention = command(
	identifyFailedMention_Schema,
	async ({ mentionId, guildId, userId }) => {
		const { locals } = getRequestEvent();

		if (!locals.user) error(401, 'Not logged in');

		await isGuildAdmin(locals.user, guildId);

		try {
			await discordApi.getUser(userId);
		} catch {
			error(400, `Discord user ${userId} not found`);
		}

		await db.failedMentions.identify(mentionId, userId, locals.user.id);

		return { success: true };
	}
);
