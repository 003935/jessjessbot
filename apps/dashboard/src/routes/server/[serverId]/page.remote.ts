import * as v from 'valibot';
import { query, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { Routes, type RESTGetAPIGuildResult } from 'discord-api-types/v10';
import { isGuildAdmin } from '$lib/server/discord.utils';
import { schema } from '@repo/database';
import { eq } from 'drizzle-orm';

export const getEventGames = query(v.string(), async (guildId) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	const guild = (await discordApi.get(Routes.guild(guildId))) as RESTGetAPIGuildResult;

	const isAdmin = await isGuildAdmin(user.user.id, guild);

	if (!isAdmin) error(403, 'Not admin');

	const eventGames = await db._db
		.select()
		.from(schema.gameRoleTable)
		.where(eq(schema.gameRoleTable.guildId, guildId));

	return eventGames.map((game) => ({
		...game,
		role: guild.roles.find((role) => role.id === game.roleId),
	}));
});

const addEventGame_Schema = v.object({
	guildId: v.string(),
	gameName: v.string(),
	roleId: v.string(),
});

export const addEventGame = command(addEventGame_Schema, async (eventGame) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	const guild = (await discordApi.get(Routes.guild(eventGame.guildId))) as RESTGetAPIGuildResult;

	const roleExists = guild.roles.some((role) => role.id === eventGame.roleId);

	if (!roleExists) error(404, 'Role not found');

	const isAdmin = await isGuildAdmin(user.user.id, guild);

	if (!isAdmin) error(403, 'Not admin');

	try {
		await discordApi.get(Routes.guildRole(eventGame.guildId, eventGame.roleId));

		await db._db.insert(schema.gameRoleTable).values({
			gameName: eventGame.gameName,
			roleId: eventGame.roleId,
			guildId: eventGame.guildId,
		});
	} catch (e) {
		console.log(e);
		error(400);
	}
});

const removeEventGame_Schema = v.object({
	guildId: v.string(),
	roleId: v.string(),
});

export const removeEventGame = command(removeEventGame_Schema, async (eventGame) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	const guild = (await discordApi.get(Routes.guild(eventGame.guildId))) as RESTGetAPIGuildResult;

	const isAdmin = await isGuildAdmin(user.user.id, guild);

	if (!isAdmin) error(403, 'Not admin');

	try {
		await db._db
			.delete(schema.gameRoleTable)
			.where(eq(schema.gameRoleTable.roleId, eventGame.roleId));
	} catch (e) {
		console.log(e);
		error(400);
	}
});
