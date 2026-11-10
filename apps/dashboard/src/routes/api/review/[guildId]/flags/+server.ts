import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { FlagsSchema, requireReviewToken } from '$lib/server/review';
import { renderFact, type ReviewFlagInput } from '@repo/database';

const FACT_PREFIX = 'memory_fact_';

// Current text of a flagged note: a saved fact, or an older preference-row detail.
async function noteText(guildId: string, userId: string, key: string): Promise<string | null> {
	if (!key.startsWith(FACT_PREFIX)) return db.botMemberPreference.getValue(guildId, userId, key);
	const fact = await db.botMemory.get(guildId, key.slice(FACT_PREFIX.length));
	// Server facts belong to no member, so their flags carry userId ''.
	if (!fact || fact.subjectId !== userId) return null;
	return renderFact(fact);
}

// Replaces the open flags with this review's. The text is looked up here so admins see the
// note as it is now; anything that no longer exists is skipped.
export const PUT: RequestHandler = async ({ request, params }) => {
	requireReviewToken(env.REVIEW_API_TOKEN, request);
	const { guildId } = params;
	const parsed = v.safeParse(FlagsSchema, await request.json().catch(() => null));
	if (!parsed.success) error(400, v.summarize(parsed.issues));

	const opinions = new Map(
		(await db.botOpinion.list(guildId)).map((entry) => [entry.topic, entry.opinion])
	);
	const flags: ReviewFlagInput[] = [];
	const skipped: string[] = [];
	for (const flag of parsed.output.flags) {
		if (flag.target === 'opinion') {
			const text = opinions.get(flag.topic);
			if (text)
				flags.push({ target: 'opinion', userId: '', key: flag.topic, text, reason: flag.reason });
			else skipped.push(`opinion:${flag.topic}`);
		} else {
			const text = await noteText(guildId, flag.userId, flag.key);
			if (text)
				flags.push({
					target: 'note',
					userId: flag.userId,
					key: flag.key,
					text,
					reason: flag.reason,
				});
			else skipped.push(`note:${flag.userId}:${flag.key}`);
		}
	}
	const open = await db.botReview.replaceOpenFlags(guildId, flags);
	return json({ open, skipped });
};
