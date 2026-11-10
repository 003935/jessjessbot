import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';
import { requireReviewToken } from '$lib/server/review';
import { isCurrent, renderFact, type MemoryFact } from '@repo/database';

const factNote = (fact: MemoryFact) => ({
	key: `memory_fact_${fact.id}`,
	text: renderFact(fact),
	source: fact.source,
	kind: fact.kind,
	createdAt: fact.createdAt.toISOString(),
});

// Everything jjb has saved for one server: member notes, opinions, lore, and what earlier
// reviews flagged (kept ones were looked at by an admin and should be left alone).
export const GET: RequestHandler = async ({ request, params }) => {
	requireReviewToken(env.REVIEW_API_TOKEN, request);
	const { guildId } = params;
	const [config, opinions, rows, allFacts, openFlags, keptFlags, latest] = await Promise.all([
		db.config.getConfig(guildId),
		db.botOpinion.list(guildId),
		db._db.botMemberPreference.findMany({
			where: { guildId, kind: { startsWith: 'memory_' } },
			orderBy: { createdAt: 'asc' },
		}),
		db.botMemory.listGuild(guildId),
		db.botReview.listFlags(guildId, 'open'),
		db.botReview.listFlags(guildId, 'kept'),
		db.botReview.latestReview(guildId),
	]);

	const facts = allFacts.filter((fact) => isCurrent(fact));
	const byUser = new Map<string, typeof rows>();
	for (const row of rows) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
	const factsByUser = new Map<string, MemoryFact[]>();
	for (const fact of facts) {
		if (!fact.subjectId) continue;
		factsByUser.set(fact.subjectId, [...(factsByUser.get(fact.subjectId) ?? []), fact]);
		if (!byUser.has(fact.subjectId)) byUser.set(fact.subjectId, []);
	}
	const members = await Promise.all(
		[...byUser].map(async ([userId, notes]) => {
			let name = userId;
			try {
				const user = await discordApi.getUser(userId);
				name = user.global_name || user.username;
			} catch {
				/* Keep the ID when Discord can't find the account. */
			}
			return {
				userId,
				name,
				notes: [
					...notes.map((note) => ({
						key: note.kind,
						text: note.value,
						savedAt: note.createdAt.toISOString(),
					})),
					...(factsByUser.get(userId) ?? []).map(factNote),
				],
			};
		})
	);

	const flag = ({ target, userId, key, text, reason }: (typeof keptFlags)[number]) => ({
		target,
		userId,
		key,
		text,
		reason,
	});
	return json({
		guildId,
		lore: config?.bot_lore ?? null,
		members,
		serverFacts: facts
			.filter((fact) => !fact.subjectId)
			.map(({ id, text, kind, createdAt }) => ({
				key: `memory_fact_${id}`,
				text,
				kind,
				createdAt: createdAt.toISOString(),
			})),
		opinions: opinions.map((entry) => ({
			topic: entry.topic,
			text: entry.opinion,
			updatedAt: entry.updatedAt.toISOString(),
		})),
		openFlags: openFlags.map(flag),
		keptFlags: keptFlags.map(flag),
		lastReview: latest
			? {
					createdAt: latest.createdAt.toISOString(),
					periodStart: latest.periodStart.toISOString(),
					periodEnd: latest.periodEnd.toISOString(),
					summary: latest.summary,
					report: latest.report,
				}
			: null,
	});
};
