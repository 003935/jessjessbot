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
};

const PET_WORDS = /\b(?:pets?|cats?|kittens?|dogs?|pupp(?:y|ies)|bunn(?:y|ies)|rabbits?|fish)\b/iu;
const BIRTHDAY_WORDS = /\b(?:birthday|bday|born|age|old)\b/iu;
const GREETING_PET_CHANCE = 0.2;
const ABOUT_ME =
	/\b(?:about me|know me|remember (?:me|what|about)|what do (?:i|u think i) (?:like|hate)|my (?:fav(?:ou?rite)?s?|likes|dislikes)|what(?:'?s| is) my)\b/iu;
const COMMON_WORDS = new Set(
	'the and but for with that this then than they them their she her his him has have had was were are not you your from about into just like likes love loves hate hates plays play really very some what when who how its also any all can cant dont does did got get one two'.split(' ')
);

function topicWords(text: string): Set<string> {
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
	options: { petChannel: boolean; random?: () => number }
): MemberDetails | null {
	if (!details) return null;
	const random = options.random ?? Math.random;
	const showPets =
		options.petChannel ||
		PET_WORDS.test(prompt) ||
		details.pets.some((pet) => mentionsWord(prompt, petName(pet))) ||
		(isGreeting(prompt) && random() < GREETING_PET_CHANCE);
	const aboutMe = ABOUT_ME.test(prompt);
	const gated: MemberDetails = {
		likes: relevant(details.likes, prompt, aboutMe),
		dislikes: relevant(details.dislikes, prompt, aboutMe),
		pets: showPets || aboutMe ? details.pets : [],
		birthday: BIRTHDAY_WORDS.test(prompt) || aboutMe ? details.birthday : null,
		favourites: relevant(details.favourites, prompt, aboutMe),
		notes: relevant(details.notes, prompt, aboutMe),
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
