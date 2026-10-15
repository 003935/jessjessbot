import * as v from 'valibot';
import { query, getRequestEvent, command, requested } from '$app/server';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import { getDiscordAcc, throwIfNotLoggedIn } from './server/permission.utils';
import { discordApi } from './server/discord';
import type { APIGuildMember } from 'discord-api-types/v10';

const query_params_schema = v.object({
	limit: v.number(),
	page: v.pipe(v.number(), v.minValue(1)),
});

export const getServerMovies = query(query_params_schema, async ({ limit, page }) => {
	const { locals, params } = getRequestEvent();

	if (!params.serverId) return error(500);

	const user = throwIfNotLoggedIn(locals);
	const { guild } = await getDiscordAcc(user, params.serverId);

	const movieCountPromise = db.movie.countServerMovies(params.serverId);

	const movies = await db.movie.getServerMovies(guild.id, { limit, offset: limit * (page - 1) });

	const userIds = new Set(movies.flatMap((m) => m.requests.map((r) => r.dUserID)));

	const memberMap = new Map<string, APIGuildMember>();

	await Promise.allSettled(
		userIds.values().map((userId) =>
			discordApi
				.getGuildMember(guild.id, userId)
				.then((member) => {
					memberMap.set(member.user.id, member);
				})
				.catch((e) => console.error(e))
		)
	);

	return {
		movies: movies.map((m) => ({
			...m,
			requests: m.requests
				.map(({ dUserID }) => {
					const member = memberMap.get(dUserID);
					if (!member) return null;
					return {
						id: member.user.id,
						name: member.nick ?? member.user.global_name ?? member.user.username,
						avatar: discordApi.getMemberAvatar(member, guild.id),
					};
				})
				.filter((m) => m !== null),
		})),
		count: await movieCountPromise,
	};
});

export const add_request = command(v.pipe(v.number(), v.integer()), async (tmdbId) => {
	const { locals, params } = getRequestEvent();

	if (!params.serverId) return error(500);

	const user = throwIfNotLoggedIn(locals);
	const { guild, discordID } = await getDiscordAcc(user, params.serverId);

	await db.movie.request(tmdbId, guild.id, discordID);

	await requested(getServerMovies, 1).refreshAll();
});

export const remove_request = command(v.pipe(v.number(), v.integer()), async (tmdbId) => {
	const { locals, params } = getRequestEvent();

	if (!params.serverId) return error(500);

	const user = throwIfNotLoggedIn(locals);
	const { guild, discordID } = await getDiscordAcc(user, params.serverId);

	await db.movie.removeRequest(tmdbId, guild.id, discordID);

	await requested(getServerMovies, 1).refreshAll();
});
