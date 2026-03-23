import * as v from 'valibot';
import { query, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import { schema } from '@repo/database';
import { eq } from 'drizzle-orm';

export const getGames = query(async () => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	const games = await db._db.select().from(schema.eventGameTable);

	return games;
});

export const removeGame = command(v.string(), async (gameName) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	await db._db.delete(schema.eventGameTable).where(eq(schema.eventGameTable.name, gameName));
});

export const addGame = command(v.string(), async (gameName) => {
	const { request } = getRequestEvent();

	const user = await auth.api.getSession({
		headers: request.headers,
	});

	if (!user) throw error(401, 'Not logged in');

	await db._db.insert(schema.eventGameTable).values({
		name: gameName,
	});
});
