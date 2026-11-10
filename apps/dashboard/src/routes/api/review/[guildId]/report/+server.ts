import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';
import { ReportSchema, requireReviewToken, reviewDm } from '$lib/server/review';

// Saves the weekly review and DMs the summary to everyone in REVIEW_DM_USER_IDS.
export const POST: RequestHandler = async ({ request, params, url }) => {
	requireReviewToken(env.REVIEW_API_TOKEN, request);
	const { guildId } = params;
	const parsed = v.safeParse(ReportSchema, await request.json().catch(() => null));
	if (!parsed.success) error(400, v.summarize(parsed.issues));
	const { dm, ...input } = parsed.output;

	const review = await db.botReview.saveReview(guildId, {
		...input,
		periodStart: new Date(input.periodStart),
		periodEnd: new Date(input.periodEnd),
	});

	const sent: string[] = [];
	const failed: string[] = [];
	const recipients = (env.REVIEW_DM_USER_IDS ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter((id) => /^\d{5,25}$/u.test(id));
	if (dm && recipients.length) {
		const openFlags = (await db.botReview.listFlags(guildId, 'open')).length;
		const guildName = await discordApi
			.getGuild(guildId)
			.then((guild) => guild.name)
			.catch(() => guildId);
		const link = `${env.ORIGIN ?? url.origin}/server/${guildId}?tab=jjb`;
		const content = reviewDm(guildName, input.summary, openFlags, link);
		for (const userId of recipients) {
			try {
				await discordApi.sendDirectMessage(userId, content);
				sent.push(userId);
			} catch {
				failed.push(userId);
			}
		}
	}
	return json({ id: review.id, dmSent: sent, dmFailed: failed });
};
