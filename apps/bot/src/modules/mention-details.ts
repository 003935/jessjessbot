// Which of the speaker's saved details she gets to see. Given a pet's name on every turn, she
// brings it up on every turn ("hola choco. hows bobby"), so pets and birthdays only come along
// when the message is about them, in the pet channel, or on the odd greeting.

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
	const gated: MemberDetails = {
		...details,
		pets: showPets ? details.pets : [],
		birthday: BIRTHDAY_WORDS.test(prompt) ? details.birthday : null,
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
