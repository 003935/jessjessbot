import * as v from 'valibot';
import { query, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import { throwIfNotAdmin, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import { discordApi } from '$lib/server/discord';
import type { APIGuildMember } from 'discord-api-types/v10';

const FailedMentionId_Schema = v.object({
	channelId: v.string(),
	messageId: v.string(),
	startOfMention: v.number(),
});

export type FailedMentionId = v.InferInput<typeof FailedMentionId_Schema>;

export type UserCandidate = {
	id: string;
	username: string;
	displayName: string | null;
	avatar: string | null;
};

export const getFailedMentions = query(v.string(), async (guildId) => {
	const { locals } = getRequestEvent();

	const user = throwIfNotLoggedIn(locals);

	await throwIfNotAdmin(user, guildId);

	return await db.failedMentions.getFailedMentionByGuildId(guildId);
});

export const searchUsers = query(
	v.object({ guildId: v.string(), query: v.string() }),
	async ({ guildId, query: searchQuery }) => {
		const { locals } = getRequestEvent();

		const user = throwIfNotLoggedIn(locals);

		await throwIfNotAdmin(user, guildId);

		const members = await discordApi.searchGuildMembers(guildId, searchQuery);

		return members.map((member: APIGuildMember) => {
			const user = member.user;
			return {
				id: user.id,
				username: user.username,
				displayName: user.global_name,
				avatar: user.avatar,
			} as UserCandidate;
		});
	}
);

const hideFailedMention_Schema = v.object({
	mentionId: FailedMentionId_Schema,
	guildId: v.string(),
});

export const hideFailedMention = command(
	hideFailedMention_Schema,
	async ({ mentionId, guildId }) => {
		const user = throwIfNotLoggedIn();

		const { discordID } = await throwIfNotAdmin(user, guildId);

		await db.failedMentions.hide(mentionId, discordID);

		return { success: true };
	}
);

const identifyFailedMention_Schema = v.object({
	mentionId: FailedMentionId_Schema,
	guildId: v.string(),
	userId: v.string(),
});

export const identifyFailedMention = command(
	identifyFailedMention_Schema,
	async ({ mentionId, guildId, userId }) => {
		const user = throwIfNotLoggedIn();

		const { discordID } = await throwIfNotAdmin(user, guildId);

		try {
			await discordApi.getUser(userId);
		} catch {
			error(400, `Discord user ${userId} not found`);
		}

		return await db.failedMentions.identify(mentionId, userId, discordID);
	}
);

const identifyFailedMentionsByDisplayName_Schema = v.object({
	displayName: v.string(),
	guildId: v.string(),
	userId: v.string(),
});

export const identifyFailedMentionsByDisplayName = command(
	identifyFailedMentionsByDisplayName_Schema,
	async ({ displayName, guildId, userId }) => {
		const user = throwIfNotLoggedIn();

		const { discordID } = await throwIfNotAdmin(user, guildId);

		try {
			await discordApi.getUser(userId);
		} catch {
			error(400, `Discord user ${userId} not found`);
		}

		return await db.failedMentions.identifyByDisplayName(displayName, guildId, userId, discordID);
	}
);
