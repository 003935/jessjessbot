import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';
import { requireReviewToken } from '$lib/server/review';

// The servers jjb is in, so the reviewer knows which ones to go through.
export const GET: RequestHandler = async ({ request }) => {
	requireReviewToken(env.REVIEW_API_TOKEN, request);
	const guilds = await discordApi.getBotGuilds();
	const result = await Promise.all(
		guilds.map(async (guild) => {
			const latest = await db.botReview.latestReview(guild.id);
			return {
				id: guild.id,
				name: guild.name,
				lastReviewAt: latest?.createdAt.toISOString() ?? null,
			};
		})
	);
	return json({ botId: discordApi.botId, guilds: result });
};
