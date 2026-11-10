import { DatabaseConnection } from '../connection';

// jjb's longer memory: facts about members and the server, and the conversations she was in.
// Facts that get replaced are closed (validTo) rather than deleted, so she can say "u used to...".

export type FactKind = 'fact' | 'plan' | 'event' | 'joke';
export type FactSource = 'self' | 'friend' | 'asked';

export type MemoryFact = {
	id: string;
	guildId: string;
	/** The member it's about; empty for server facts. */
	subjectId: string;
	text: string;
	keywords: string[];
	people: string[];
	kind: string;
	source: string;
	saidById: string;
	saidByName: string;
	sourceMessageId: string;
	expiresAt: Date | null;
	validTo: Date | null;
	createdAt: Date;
};

export type NewFact = {
	subjectId: string;
	text: string;
	keywords?: string[];
	people?: string[];
	kind?: FactKind;
	source?: FactSource;
	saidById?: string;
	saidByName?: string;
	sourceMessageId?: string;
	expiresAt?: Date | null;
};

export type ChatLine = { userId: string; name: string; text: string; at: string };

export type ChatWindow = {
	id: string;
	channelId: string;
	channelName: string;
	userIds: string[];
	lines: ChatLine[];
	summary: string;
	startedAt: Date;
	endedAt: Date;
};

// Active facts kept per member, by who it came from, and for the server. Oldest go first.
export const FACT_LIMITS = { own: 20, friend: 10, server: 80 } as const;
// Past facts (replaced by newer ones) kept per member so she remembers what changed.
const PAST_FACTS_KEPT = 10;
const WINDOW_DAYS_KEPT = 180;
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

export function isCurrent(
	fact: Pick<MemoryFact, 'validTo' | 'expiresAt'>,
	now = new Date()
): boolean {
	return !fact.validTo && (!fact.expiresAt || fact.expiresAt > now);
}

/** How a fact reads to jjb: who said it if it's hearsay, and roughly when she learned it. */
export function renderFact(
	fact: Pick<MemoryFact, 'text' | 'source' | 'saidByName' | 'createdAt'>
): string {
	const said = fact.source === 'friend' && fact.saidByName ? `${fact.saidByName} says: ` : '';
	const when = `${MONTHS[fact.createdAt.getUTCMonth()]} ${fact.createdAt.getUTCFullYear()}`;
	return `${said}${fact.text} (${when})`;
}

/** Which bucket a fact counts against for FACT_LIMITS. */
export function factBucket(
	fact: Pick<MemoryFact, 'subjectId' | 'source'>
): keyof typeof FACT_LIMITS {
	if (!fact.subjectId) return 'server';
	return fact.source === 'friend' ? 'friend' : 'own';
}

/** Ids of the oldest current facts over the limit for their bucket. */
export function overLimit(facts: MemoryFact[]): string[] {
	const buckets = new Map<string, MemoryFact[]>();
	for (const fact of facts) {
		const key = `${fact.subjectId}:${factBucket(fact)}`;
		buckets.set(key, [...(buckets.get(key) ?? []), fact]);
	}
	const extra: string[] = [];
	for (const group of buckets.values()) {
		const limit = FACT_LIMITS[factBucket(group[0]!)];
		const newestFirst = [...group].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		extra.push(...newestFirst.slice(limit).map((fact) => fact.id));
	}
	return extra;
}

const SEARCH_SKIP = new Set(
	'the and but for with that this then than they them their she her his him has have had was were are not you your from about into just what when who how did does remember jjb'.split(
		' '
	)
);

/** Words to search for, any of which can match (ranked by how many do). */
export function searchQuery(text: string): string {
	const words = (text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter(
		(word) => !SEARCH_SKIP.has(word)
	);
	return [...new Set(words)].slice(0, 8).join(' | ');
}

export function windowText(lines: ChatLine[]): string {
	return lines.map((line) => `${line.name}: ${line.text}`).join('\n');
}

export class BotMemoryTable extends DatabaseConnection {
	/** Current facts about these members (or the server, with ''), oldest first. */
	async current(guildId: string, subjectIds: string[], now = new Date()): Promise<MemoryFact[]> {
		if (!subjectIds.length) return [];
		return this._db.botMemoryFact.findMany({
			where: {
				guildId,
				subjectId: { in: subjectIds },
				validTo: null,
				OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
			},
			orderBy: { createdAt: 'asc' },
			take: 400,
		});
	}

	/** Current facts that mention a member without being about them ("movie night with sam"). */
	async involving(guildId: string, userId: string, now = new Date()): Promise<MemoryFact[]> {
		return this._db.botMemoryFact.findMany({
			where: {
				guildId,
				people: { has: userId },
				validTo: null,
				OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
			},
			orderBy: { createdAt: 'desc' },
			take: 20,
		});
	}

	/** Everything for one server, current and past, for the dashboard and the reviewer. */
	async listGuild(guildId: string): Promise<MemoryFact[]> {
		return this._db.botMemoryFact.findMany({
			where: { guildId },
			orderBy: { createdAt: 'asc' },
			take: 5000,
		});
	}

	/** Everything about one member, current and past, for their own page. */
	async listFor(guildId: string, userId: string): Promise<MemoryFact[]> {
		return this._db.botMemoryFact.findMany({
			where: { guildId, subjectId: userId },
			orderBy: { createdAt: 'desc' },
			take: 200,
		});
	}

	/** Servers where jjb has saved anything about this member. */
	async guildsFor(userId: string): Promise<string[]> {
		const rows = await this._db.botMemoryFact.findMany({
			where: { subjectId: userId },
			distinct: ['guildId'],
			select: { guildId: true },
		});
		return rows.map((row) => row.guildId);
	}

	async get(guildId: string, id: string): Promise<MemoryFact | null> {
		return this._db.botMemoryFact.findFirst({ where: { guildId, id } });
	}

	/**
	 * Saves new facts and closes the ones they replace, then trims each member's (and the
	 * server's) current facts to FACT_LIMITS. Exact repeats of a current fact are skipped.
	 */
	async add(
		guildId: string,
		facts: NewFact[],
		replaces: string[] = [],
		now = new Date()
	): Promise<MemoryFact[]> {
		const subjects = [...new Set(facts.map((fact) => fact.subjectId))];
		const existing = await this.current(guildId, subjects, now);
		const known = new Set(
			existing.map((fact) => `${fact.subjectId}:${fact.text.toLocaleLowerCase()}`)
		);
		const created: MemoryFact[] = [];
		await this._db.$transaction(async (tx) => {
			if (replaces.length)
				await tx.botMemoryFact.updateMany({
					where: { guildId, id: { in: replaces }, validTo: null },
					data: { validTo: now },
				});
			for (const fact of facts) {
				const key = `${fact.subjectId}:${fact.text.toLocaleLowerCase()}`;
				if (known.has(key)) continue;
				known.add(key);
				created.push(
					await tx.botMemoryFact.create({
						data: {
							guildId,
							subjectId: fact.subjectId,
							text: fact.text,
							keywords: fact.keywords ?? [],
							people: fact.people ?? [],
							kind: fact.kind ?? 'fact',
							source: fact.source ?? 'self',
							saidById: fact.saidById ?? '',
							saidByName: fact.saidByName ?? '',
							sourceMessageId: fact.sourceMessageId ?? '',
							expiresAt: fact.expiresAt ?? null,
							createdAt: now,
						},
					})
				);
			}
		});
		if (created.length) await this.trim(guildId, subjects, now);
		return created;
	}

	private async trim(guildId: string, subjectIds: string[], now: Date): Promise<void> {
		const extra = overLimit(await this.current(guildId, subjectIds, now));
		if (extra.length)
			await this._db.botMemoryFact.deleteMany({ where: { guildId, id: { in: extra } } });
		for (const subjectId of subjectIds) {
			if (!subjectId) continue;
			const past = await this._db.botMemoryFact.findMany({
				where: { guildId, subjectId, validTo: { not: null } },
				orderBy: { validTo: 'desc' },
				select: { id: true },
				skip: PAST_FACTS_KEPT,
			});
			if (past.length)
				await this._db.botMemoryFact.deleteMany({
					where: { id: { in: past.map((row) => row.id) } },
				});
		}
	}

	/** Marks facts as no longer true without forgetting them. */
	async close(guildId: string, ids: string[], now = new Date()): Promise<number> {
		if (!ids.length) return 0;
		const result = await this._db.botMemoryFact.updateMany({
			where: { guildId, id: { in: ids }, validTo: null },
			data: { validTo: now },
		});
		return result.count;
	}

	async forget(guildId: string, id: string): Promise<boolean> {
		const result = await this._db.botMemoryFact.deleteMany({ where: { guildId, id } });
		return result.count > 0;
	}

	/** Deletes a member's fact by its text, as written or as jjb saw it. */
	async forgetText(guildId: string, subjectId: string, value: string): Promise<boolean> {
		const wanted = value.trim().toLocaleLowerCase();
		const facts = await this.current(guildId, [subjectId]);
		const match = facts.find(
			(fact) =>
				fact.text.toLocaleLowerCase() === wanted || renderFact(fact).toLocaleLowerCase() === wanted
		);
		return match ? this.forget(guildId, match.id) : false;
	}

	/** Deletes facts about a member, optionally only the ones they or friends told her. */
	async forgetSubject(guildId: string, userId: string, sources?: FactSource[]): Promise<number> {
		const result = await this._db.botMemoryFact.deleteMany({
			where: { guildId, subjectId: userId, ...(sources ? { source: { in: sources } } : {}) },
		});
		return result.count;
	}

	/**
	 * "Forget everything about me": facts about them, their name on other facts, and their
	 * lines in saved conversations all go.
	 */
	async forgetPerson(guildId: string, userId: string): Promise<number> {
		const removed = await this.forgetSubject(guildId, userId);
		const involving = await this._db.botMemoryFact.findMany({
			where: { guildId, people: { has: userId } },
			select: { id: true, people: true },
		});
		for (const fact of involving)
			await this._db.botMemoryFact.update({
				where: { id: fact.id },
				data: { people: fact.people.filter((id) => id !== userId) },
			});
		await this._db.botMemoryFact.updateMany({
			where: { guildId, saidById: userId },
			data: { saidById: '', saidByName: 'someone' },
		});
		const windows = await this._db.botChatWindow.findMany({
			where: { guildId, userIds: { has: userId } },
			select: { id: true, lines: true, userIds: true },
		});
		for (const window of windows) {
			const lines = (window.lines as ChatLine[]).filter((line) => line.userId !== userId);
			if (!lines.length) {
				await this._db.botChatWindow.delete({ where: { id: window.id } });
				continue;
			}
			await this._db.botChatWindow.update({
				where: { id: window.id },
				data: {
					lines,
					text: windowText(lines),
					userIds: window.userIds.filter((id) => id !== userId),
					// The summary may describe them; it's cheap to lose.
					summary: '',
				},
			});
		}
		return removed;
	}

	async forgetGuildServerFacts(guildId: string): Promise<number> {
		const result = await this._db.botMemoryFact.deleteMany({ where: { guildId, subjectId: '' } });
		return result.count;
	}

	async saveWindow(
		guildId: string,
		window: Omit<ChatWindow, 'id' | 'userIds'> & { userIds?: string[] },
		now = new Date()
	): Promise<string> {
		const userIds = window.userIds ?? [...new Set(window.lines.map((line) => line.userId))];
		const row = await this._db.botChatWindow.create({
			data: {
				guildId,
				channelId: window.channelId,
				channelName: window.channelName,
				userIds,
				lines: window.lines,
				text: windowText(window.lines),
				summary: window.summary,
				startedAt: window.startedAt,
				endedAt: window.endedAt,
			},
		});
		const cutoff = new Date(now.getTime() - WINDOW_DAYS_KEPT * 86_400_000);
		await this._db.botChatWindow.deleteMany({ where: { guildId, endedAt: { lt: cutoff } } });
		return row.id;
	}

	async setWindowSummary(id: string, summary: string): Promise<void> {
		await this._db.botChatWindow.update({ where: { id }, data: { summary } });
	}

	/** Past conversations matching the words, best match first (Postgres full-text search). */
	async searchWindows(
		guildId: string,
		query: string,
		limit = 3,
		userId?: string
	): Promise<ChatWindow[]> {
		const words = searchQuery(query.slice(0, 300));
		if (!words && !userId) return [];
		const rows = words
			? await this._db.$queryRaw<Array<{ id: string }>>`
				SELECT "id" FROM "bot_chat_windows"
				WHERE "guildId" = ${guildId}
					AND (${userId ?? null}::text IS NULL OR ${userId ?? ''} = ANY("userIds"))
					AND to_tsvector('simple', "summary" || ' ' || "text") @@ to_tsquery('simple', ${words})
				ORDER BY ts_rank(to_tsvector('simple', "summary" || ' ' || "text"), to_tsquery('simple', ${words})) DESC, "endedAt" DESC
				LIMIT ${limit}`
			: await this._db.botChatWindow.findMany({
					where: { guildId, userIds: { has: userId! } },
					orderBy: { endedAt: 'desc' },
					select: { id: true },
					take: limit,
				});
		if (!rows.length) return [];
		const windows = await this._db.botChatWindow.findMany({
			where: { id: { in: rows.map((row) => row.id) } },
		});
		const order = new Map(rows.map((row, index) => [row.id, index]));
		return windows
			.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
			.map((row) => ({ ...row, lines: row.lines as ChatLine[] }));
	}

	async recentWindows(guildId: string, limit = 20): Promise<ChatWindow[]> {
		const rows = await this._db.botChatWindow.findMany({
			where: { guildId },
			orderBy: { endedAt: 'desc' },
			take: limit,
		});
		return rows.map((row) => ({ ...row, lines: row.lines as ChatLine[] }));
	}
}
