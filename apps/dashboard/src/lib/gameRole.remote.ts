import * as v from 'valibot';
import { query, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { isGuildAdmin } from '$lib/server/discord.utils';
import { schema } from '@repo/database';
import { eq } from 'drizzle-orm';

export const getGameRoles = query(v.string(), async (guildId) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	const guild_promise = discordApi.getGuild(guildId);

	const isAdmin = await isGuildAdmin(user.user.id, guild_promise);

	if (!isAdmin) error(403, 'Not admin');

	const gameRoles = await db._db
		.select()
		.from(schema.gameRoleTable)
		.where(eq(schema.gameRoleTable.guildId, guildId));

	const roles = (await guild_promise).roles;

	return gameRoles.map((game) => ({
		...game,
		role: roles.find((role) => role.id === game.roleId),
	}));
});

const addGameRole_Schema = v.object({
	guildId: v.string(),
	gameName: v.string(),
	roleId: v.string(),
});

export const addGameRole = command(addGameRole_Schema, async (gameRole) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	const guild = await discordApi.getGuild(gameRole.guildId);

	const roleExists = guild.roles.some((role) => role.id === gameRole.roleId);

	if (!roleExists) error(404, 'Role not found');

	const isAdmin = await isGuildAdmin(user.user.id, guild);

	if (!isAdmin) error(403, 'Not admin');

	try {
		await db._db.insert(schema.gameRoleTable).values({
			gameName: gameRole.gameName,
			roleId: gameRole.roleId,
			guildId: gameRole.guildId,
		});
	} catch (e) {
		console.log(e);
		error(400);
	}
});

const removeGameRole_Schema = v.object({
	guildId: v.string(),
	roleId: v.string(),
});

export const removeGameRole = command(removeGameRole_Schema, async (gameRole) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	const guild = await discordApi.getGuild(gameRole.guildId);

	const isAdmin = await isGuildAdmin(user.user.id, guild);

	if (!isAdmin) error(403, 'Not admin');

	try {
		await db._db
			.delete(schema.gameRoleTable)
			.where(eq(schema.gameRoleTable.roleId, gameRole.roleId));
	} catch (e) {
		console.log(e);
		error(400);
	}
});
