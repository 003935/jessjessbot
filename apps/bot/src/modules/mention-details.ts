// Which of the speaker's saved details she gets to see. Given a detail on every turn, she
// brings it up on every turn ("hola choco. hows bobby", the same note in every reply), so each
// detail only comes along when the message is about it. Pets also come along in the pet
// channel or on the odd greeting; everything comes along when they ask what she knows.

export type MemberDetails = {
	likes: string[];
	dislikes: string[];
	pets: string[];
	birthday: string | null;
	favourites: string[];
	notes: string[];
	/** Extra words per note that should bring it up ("ranked" for a league note). */
	noteKeywords?: string[][];
};

const PET_WORDS = /\b(?:pets?|cats?|kittens?|dogs?|pupp(?:y|ies)|bunn(?:y|ies)|rabbits?|fish)\b/iu;
const BIRTHDAY_WORDS = /\b(?:birthday|bday|born|age|old)\b/iu;
const GREETING_PET_CHANCE = 0.2;
const ABOUT_ME =
	/\b(?:about me|know me|remember (?:me|what|about)|what do (?:i|u think i) (?:like|hate)|my (?:fav(?:ou?rite)?s?|likes|dislikes)|what(?:'?s| is) my)\b/iu;
const COMMON_WORDS = new Set(
	'the and but for with that this then than they them their she her his him has have had was were are not you your from about into just like likes love loves hate hates plays play really very some what when who how its also any all can cant dont does did got get one two'.split(' ')
);

export function topicWords(text: string): Set<string> {
	return new Set(
		(text.toLocaleLowerCase().match(/\p{L}{3,}/gu) ?? [])
			.filter((word) => !COMMON_WORDS.has(word))
			.map((word) => word.replace(/(?:ing|es|s)$/u, ''))
			.filter((word) => word.length >= 3)
	);
}

function relevant(items: string[], prompt: string, all: boolean): string[] {
	if (all) return items;
	const asked = topicWords(prompt);
	return items.filter((item) => [...topicWords(item)].some((word) => asked.has(word)));
}

// The same note in every reply is what makes her sound like she's reading a file, so a note
// she just used sits out for a while unless they ask what she knows.
const NOTE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const MAX_NOTES_SHOWN = 3;
const lastUsed = new Map<string, number>();

export function noteCooling(note: string, now = Date.now()): boolean {
	const at = lastUsed.get(note);
	return at !== undefined && now - at < NOTE_COOLDOWN_MS;
}

/** After a reply: notes that share a topic word with what she said count as used. */
export function markNotesUsed(notes: string[], reply: string, now = Date.now()): string[] {
	const said = topicWords(reply);
	const used = notes.filter((note) =>
		[...topicWords(note.replace(/ \([a-z]{3} \d{4}\)$/u, ''))].some((word) => said.has(word))
	);
	for (const note of used) lastUsed.set(note, now);
	if (lastUsed.size > 5000)
		for (const [note, at] of lastUsed) if (now - at >= NOTE_COOLDOWN_MS) lastUsed.delete(note);
	return used;
}

export function resetNoteCooldowns(): void {
	lastUsed.clear();
}

/** Notes that fit the message best, at most MAX_NOTES_SHOWN, skipping ones she just used. */
export function relevantNotes(
	notes: string[],
	keywords: string[][] | undefined,
	prompt: string,
	all: boolean,
	now = Date.now()
): string[] {
	if (all) return notes.slice(-12);
	const asked = topicWords(prompt);
	return notes
		.map((note, index) => {
			const words = new Set([
				...topicWords(note.replace(/ \([a-z]{3} \d{4}\)$/u, '')),
				...topicWords((keywords?.[index] ?? []).join(' ')),
			]);
			return { note, index, hits: [...words].filter((word) => asked.has(word)).length };
		})
		.filter((item) => item.hits > 0 && !noteCooling(item.note, now))
		.sort((a, b) => b.hits - a.hits || b.index - a.index)
		.slice(0, MAX_NOTES_SHOWN)
		.map((item) => item.note);
}

export function isGreeting(input: string): boolean {
	return /^(?:hi+|he+y+|hello+|hola|yo+|wass?up|what'?s up)[!? .]*$/iu.test(input.trim());
}

/** "cheesy (cat)" -> "cheesy"; saved pets are free text, the name comes first. */
function petName(pet: string): string {
	return pet.split(/\s*(?:[(,:]|\s-\s|\bis\b)/u)[0]!.trim();
}

function mentionsWord(text: string, word: string): boolean {
	if (!word) return false;
	const escaped = word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

export function detailsForPrompt(
	prompt: string,
	details: MemberDetails | null,
	options: { petChannel: boolean; random?: () => number; aboutThem?: boolean; now?: number }
): MemberDetails | null {
	if (!details) return null;
	const random = options.random ?? Math.random;
	const showPets =
		options.petChannel ||
		PET_WORDS.test(prompt) ||
		details.pets.some((pet) => mentionsWord(prompt, petName(pet))) ||
		(isGreeting(prompt) && random() < GREETING_PET_CHANCE);
	const aboutMe = options.aboutThem ?? ABOUT_ME.test(prompt);
	const gated: MemberDetails = {
		likes: relevant(details.likes, prompt, aboutMe),
		dislikes: relevant(details.dislikes, prompt, aboutMe),
		pets: showPets || aboutMe ? details.pets : [],
		birthday: BIRTHDAY_WORDS.test(prompt) || aboutMe ? details.birthday : null,
		favourites: relevant(details.favourites, prompt, aboutMe),
		notes: relevantNotes(details.notes, details.noteKeywords, prompt, aboutMe, options.now),
	};
	const empty =
		!gated.likes.length &&
		!gated.dislikes.length &&
		!gated.pets.length &&
		!gated.birthday &&
		!gated.favourites.length &&
		!gated.notes.length;
	return empty ? null : gated;
}
