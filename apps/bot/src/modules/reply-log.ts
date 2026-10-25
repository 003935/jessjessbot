// What jjb said lately in each channel, kept apart from the chat history so photo reactions
// and chat replies can both see it. Used to tell her what not to repeat, and to catch the
// stock openings and props she leans on ("oh ur alive", "that cat is", "noted").

const MAX_REPLIES = 8;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const OPENER_WINDOW = 5;

export const CRUTCH_PHRASES = [
	'oh ur alive',
	'load bearing',
	'noted',
	'what do u want',
	'dont get used to it',
	'thin ice',
	'im stealing',
	'that cat is',
	'has seen things',
	'judging',
	'war crime',
	'crime',
	'professionally lazy',
	'snack',
	'mango',
	'dumpling',
	'hand it over',
	'legally',
];

const log = new Map<string, Array<{ reply: string; at: number }>>();

function fresh(channelId: string, now: number) {
	return (log.get(channelId) ?? []).filter((entry) => now - entry.at < MAX_AGE_MS);
}

export function logReply(channelId: string, reply: string, now = Date.now()): void {
	log.set(channelId, [...fresh(channelId, now), { reply, at: now }].slice(-MAX_REPLIES));
}

/** Newest last. */
export function recentReplies(channelId: string, now = Date.now()): string[] {
	return fresh(channelId, now).map((entry) => entry.reply);
}

export function lastReplyAt(channelId: string): number | null {
	return log.get(channelId)?.at(-1)?.at ?? null;
}

function normalise(text: string): string {
	return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function opener(text: string): string {
	return normalise(text).split(' ').slice(0, 2).join(' ');
}

function hasPhrase(normalised: string, phrase: string): boolean {
	return ` ${normalised} `.includes(` ${phrase} `);
}

/** Why a reply repeats her recent ones: a shared two-word opening, or a crutch phrase used again. */
export function staleParts(reply: string, recent: string[]): string[] {
	const parts: string[] = [];
	const start = opener(reply);
	if (start.includes(' ') && recent.slice(-OPENER_WINDOW).some((previous) => opener(previous) === start))
		parts.push(`opener:${start}`);
	const text = normalise(reply);
	const previous = recent.map(normalise);
	for (const phrase of CRUTCH_PHRASES)
		if (hasPhrase(text, phrase) && previous.some((line) => hasPhrase(line, phrase)))
			parts.push(`phrase:${phrase}`);
	return parts;
}

export function avoidPrompt(recent: string[]): string {
	if (!recent.length) return '';
	return `Your last replies in this channel, newest last. Do not reuse their openings, phrases, or bits:\n${recent
		.map((reply) => `- ${reply.replace(/\s+/gu, ' ').slice(0, 120)}`)
		.join('\n')}`;
}
