import * as v from 'valibot';
import { query, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import { schema } from '@repo/database';
import { eq } from 'drizzle-orm';

export const getEventGames = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) return error(401, 'Not logged in');

	const can_list_games = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['list'] },
		},
	});

	if (!can_list_games.success) return error(403, 'Not authorized');

	const eventGames = await db._db.select().from(schema.eventGameTable);

	return eventGames;
});

export const removeEventGame = command(v.string(), async (gameName) => {
	const { locals } = getRequestEvent();

	if (!locals.user) error(401, 'Not logged in');

	const can_manage_games = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['manage'] },
		},
	});

	if (!can_manage_games.success) error(403, 'Not authorized');

	await db._db.delete(schema.eventGameTable).where(eq(schema.eventGameTable.name, gameName));
});

const addEventGame_Schema = v.object({
	gameName: v.string(),
	icon: v.pipe(
		v.nullable(v.string()),
		v.transform((value) => (value === '' ? null : value))
	),
});

export const addEventGame = command(addEventGame_Schema, async (game) => {
	const { locals } = getRequestEvent();

	if (!locals.user) error(401, 'Not logged in');

	const can_manage_games = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['manage'] },
		},
	});

	if (!can_manage_games.success) error(403, 'Not authorized');

	await db._db.insert(schema.eventGameTable).values({
		name: game.gameName,
		icon: game.icon,
	});
});

const updateEventGame_Schema = v.object({
	oldName: v.string(),
	gameName: v.string(),
	icon: v.pipe(
		v.nullable(v.string()),
		v.transform((value) => (value === '' ? null : value))
	),
});

export const updateEventGame = command(updateEventGame_Schema, async (game) => {
	const { locals } = getRequestEvent();

	if (!locals.user) error(401, 'Not logged in');

	const can_manage_games = await auth.api.userHasPermission({
		body: {
			userId: locals.user.id,
			role: locals.user.role,
			permissions: { game: ['manage'] },
		},
	});

	if (!can_manage_games.success) error(403, 'Not authorized');

	await db._db
		.update(schema.eventGameTable)
		.set({
			name: game.gameName,
			icon: game.icon,
		})
		.where(eq(schema.eventGameTable.name, game.oldName));
});
