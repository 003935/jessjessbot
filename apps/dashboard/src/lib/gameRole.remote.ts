import * as v from 'valibot';
import { query, command, getRequestEvent, requested } from '$app/server';
import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import { GameRole_Schema } from './components/GameRoleDialog.svelte';
import { throwIfNotAdmin, throwIfNotLoggedIn } from './server/permission.utils';

export const getGameRoles = query<
	v.StringSchema<undefined>,
	{
		gameName: string;
		roleId: string;
		roleName?: string;
	}[]
>(v.string(), async (guildId) => {
	const { locals } = getRequestEvent();

	const user = throwIfNotLoggedIn(locals);

	const [roles, gameRoles] = await Promise.all([
		throwIfNotAdmin(user, guildId).then(({ guild }) => guild.roles),
		db.game_roles.get_by_guild_id(guildId),
	]);

	const ret = new Map<string, { gameName: string; roleId: string; roleName?: string }>(
		gameRoles.map((game) => [game.roleId, { gameName: game.gameName, roleId: game.roleId }])
	);

	for (const role of roles) {
		const gRole = ret.get(role.id);
		if (gRole) gRole.roleName = role.name;
	}

	return Array.from(ret.values());
});

const addGameRole_Schema = v.object({
	...GameRole_Schema.entries,
	guildId: v.pipe(
		v.string(),
		v.transform((value) => value.trim()),
		v.nonEmpty('Guild ID cannot be empty')
	),
});

export const addGameRole = command(addGameRole_Schema, async (gameRole) => {
	const { locals } = getRequestEvent();

	const user = throwIfNotLoggedIn(locals);

	await Promise.all([
		db.game_roles
			.role_exists_in_guild(gameRole.roleId, gameRole.guildId)
			.then((exists) => exists && error(400, 'Role already assigned')),
		db.game_roles.game_exists_in_guild(gameRole.guildId, gameRole.gameName).then((exists) => {
			if (exists) error(400, 'Game already assigned');
		}),
		throwIfNotAdmin(user, gameRole.guildId).then(({ guild }) => {
			const roleExists = guild.roles.some((role) => role.id === gameRole.roleId);
			if (!roleExists) error(404, 'Role not found');
		}),
		db.games.exists(gameRole.gameName).then((exists) => !exists && error(404, 'Game not found')),
	]);

	try {
		await db.game_roles.insert({
			gameName: gameRole.gameName,
			roleId: gameRole.roleId,
			guildId: gameRole.guildId,
		});

		await requested(getGameRoles, 1).refreshAll();
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Unknown database error';
		console.error(`[GameRole] Failed to add game role: ${errorMessage}`, {
			guildId: gameRole.guildId,
			roleId: gameRole.roleId,
			gameName: gameRole.gameName,
		});
		error(500, 'Failed to add game role');
	}
});

const updateGameRole_Schema = v.object({
	...GameRole_Schema.entries,
	old: addGameRole_Schema,
});

export const updateGameRole = command(updateGameRole_Schema, async (gameRole) => {
	const { locals } = getRequestEvent();

	const user = throwIfNotLoggedIn(locals);

	await Promise.all([
		db.game_roles
			.role_exists_in_guild(gameRole.old.guildId, gameRole.old.roleId)
			.then((exists) => !exists && error(404, 'Game Role not found')),
		db.game_roles.role_exists_in_guild(gameRole.old.guildId, gameRole.roleId).then((exists) => {
			if (exists && gameRole.old.roleId !== gameRole.roleId) error(400, 'Role already assigned');
		}),
		db.game_roles.game_exists_in_guild(gameRole.old.guildId, gameRole.gameName).then((exists) => {
			if (exists && gameRole.old.gameName !== gameRole.gameName)
				error(400, 'Game already assigned');
		}),
		throwIfNotAdmin(user, gameRole.old.guildId).then(({ guild }) => {
			const roleExists = guild.roles.some((role) => role.id === gameRole.roleId);
			if (!roleExists) error(404, 'Role not found');
		}),
		db.games.exists(gameRole.gameName).then((exists) => !exists && error(404, 'Game not found')),
	]);

	try {
		await db.game_roles.update(gameRole.old.guildId, gameRole.old.roleId, {
			roleId: gameRole.roleId,
			gameName: gameRole.gameName,
		});
		await requested(getGameRoles, 1).refreshAll();
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Unknown database error';
		console.error(`[GameRole] Failed to update game role: ${errorMessage}`, {
			guildId: gameRole.old.guildId,
			oldRoleId: gameRole.old.roleId,
			newRoleId: gameRole.roleId,
			gameName: gameRole.gameName,
		});
		error(500, 'Failed to update game role');
	}
});

const removeGameRole_Schema = v.object({
	guildId: v.string(),
	roleId: v.string(),
});

export const removeGameRole = command(removeGameRole_Schema, async (gameRole) => {
	const { locals } = getRequestEvent();

	const user = throwIfNotLoggedIn(locals);
	await throwIfNotAdmin(user, gameRole.guildId);

	try {
		await db.game_roles.delete(gameRole.guildId, gameRole.roleId);
		await requested(getGameRoles, 1).refreshAll();
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : 'Unknown database error';
		console.error(`[GameRole] Failed to remove game role: ${errorMessage}`, {
			guildId: gameRole.guildId,
			roleId: gameRole.roleId,
		});
		error(500, 'Failed to remove game role');
	}
});
