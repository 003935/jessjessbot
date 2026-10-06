// Stardew-style gift tastes. Pure data and parsing, no Discord or database imports,
// so it can be tested directly. Keep likes in sync with personality/jess-preferences.json.

export type GiftTaste = 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated';

export const GIFT_POINTS: Record<GiftTaste, number> = {
	loved: 8,
	liked: 4,
	neutral: 1,
	disliked: -3,
	hated: -6,
};

// Checked in order, so hated and loved win over the broader lists.
const TASTES: Array<[GiftTaste, RegExp]> = [
	[
		'hated',
		/\b(?:wasabi|ginger|wisdom scrolls?|scrolls? of wisdom|coal|spiders?|cockroach(?:es)?|worms?|bills?|homework|taxes|ex)\b/iu,
	],
	[
		'loved',
		/\b(?:mangos?|mangoes|mango sticky rice|kittens?|bubble tea|boba|milk tea|egg tarts?|xiao ?long ?bao|soup dumplings?|mooncakes?|mirror of kalandra|mirrors?|headhunter)\b/iu,
	],
	[
		'disliked',
		/\b(?:celery|durian|cilantro|coriander|broccoli|socks?|rocks?|stones?|mud|vegemite|marmite|olives?)\b/iu,
	],
	[
		'liked',
		/\b(?:cats?|strawberr(?:y|ies)|peach(?:es)?|lychees?|pocky|cookies?|cake|ice ?cream|chocolates?|flowers?|roses?|plush(?:ie|ies)?|stuffed animals?|dumplings?|bao|hot ?pot|noodles|ramen|matcha|divines?|divine orbs?|rp|riot points|skins?|snacks?|candy|sweets|red ?bulls?|monsters?|energy drinks?|coffee|espresso|caffeine)\b/iu,
	],
];

// Items whose points differ from their taste's default.
const POINT_OVERRIDES: Array<[RegExp, number]> = [
	// She likes caffeine, but it's no mango.
	[/\b(?:red ?bulls?|monsters?|energy drinks?|coffee|espresso|caffeine)\b/iu, 2],
];

export function giftPoints(item: string, taste: GiftTaste): number {
	if (taste === 'hated' || taste === 'loved') return GIFT_POINTS[taste];
	for (const [pattern, points] of POINT_OVERRIDES) if (pattern.test(item)) return points;
	return GIFT_POINTS[taste];
}

// Gift points are on the taste scale above (+8 = loved). The meter moves in tenths, and a
// loved gift is worth about 1.4 points: tenths = round(points x 1.8).
export function giftMeterTenths(points: number): number {
	return Math.round(points * 1.8);
}

export function giftTaste(item: string): GiftTaste {
	for (const [taste, pattern] of TASTES) if (pattern.test(item)) return taste;
	return 'neutral';
}

// Longer phrases first so "a bowl of hot pot" gives "hot pot", not "bowl of hot pot".
const ARTICLE = String.raw`(?:(?:a|an|some)\s+(?:box|bag|bowl|plate|cup|slice|pack|piece)\s+of|a|an|some|the|this|these|my|ur|your)\s+`;
const BOT = String.raw`(?:you|u|jjb|jessjessbot)`;
const GIFT_PATTERNS = [
	// *gives u a mango*  /  *hands jjb boba*  (roleplay asterisks make the article optional)
	new RegExp(String.raw`^\*\s*(?:gives?|gifts?|hands?|offers?|tosses?|throws?)\s+${BOT}\s+(?:${ARTICLE})?(.+?)\s*\*$`, 'iu'),
	// gives u a mango / i give u some boba / i got u a mango / i brought u a mango
	new RegExp(String.raw`^(?:i\s+)?(?:gives?|gifts?|hands?|offers?|got|brought|bought|made)\s+${BOT}\s+${ARTICLE}(.+?)[.!~]*$`, 'iu'),
	// here's a mango for u
	new RegExp(String.raw`^here(?:'s|s| is| are)\s+${ARTICLE}(.+?)\s+for\s+${BOT}[.!~]*$`, 'iu'),
	// gift: mango
	/^(?:gift|present)\s*:\s*(.+?)[.!~]*$/iu,
];

export function parseGift(prompt: string): string | null {
	const text = prompt.trim();
	for (const pattern of GIFT_PATTERNS) {
		const item = text.match(pattern)?.[1]?.trim().replace(/\s+/gu, ' ');
		if (!item) continue;
		if (item.length > 40 || item.split(' ').length > 5) return null;
		if (!/^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u.test(item)) return null;
		return item.toLocaleLowerCase();
	}
	return null;
}

const REACTIONS: Record<GiftTaste, Array<(item: string) => string>> = {
	loved: [
		(item) => `WAIT. ${item}?? for me?? ok ur my favourite now. dont tell anyone`,
		(item) => `${item}!!! ok i take back every mean thing i said (for today)`,
		(item) => `...how did u know. ${item} is literally my favourite. thank u (⁄ ⁄•⁄ω⁄•⁄ ⁄)`,
	],
	liked: [
		(item) => `ooh ${item}. ok this is actually nice, thanks`,
		(item) => `${item}? not bad. ill keep it`,
		(item) => `hm. ${item}. ur getting better at this`,
	],
	neutral: [
		(item) => `${item}... ok. thanks i guess`,
		(item) => `${item}. sure. ill put it somewhere`,
		(item) => `i dont really know what to do with ${item} but the thought counts`,
	],
	disliked: [
		(item) => `${item}?? why would u give me this`,
		(item) => `ew ${item}. ill pretend i didnt see that`,
		(item) => `oh. ${item}. great. (it is not great)`,
	],
	hated: [
		(item) => `${item}. the ick. actually the ick. take it back`,
		(item) => `EW. ${item}?? im telling mom`,
		(item) => `u gave me ${item}. we are not friends right now`,
	],
};

// For Jess and Hannah: she is too scared to be rude, so bad gifts get nervous politeness.
const POLITE_REACTIONS: Record<GiftTaste, Array<(item: string) => string>> = {
	loved: [(item) => `${item}!! thank u thank u, ill treasure it forever`],
	liked: [(item) => `thank u for ${item}, i like it a lot`],
	neutral: [(item) => `thank u for ${item}!`],
	disliked: [(item) => `oh! ${item}. thank u. ill... finish it later`],
	hated: [(item) => `...thank u for ${item}. its ok. its really ok. (it is not ok)`],
};

export function giftReaction(item: string, taste: GiftTaste, polite = false, roll = Math.random()): string {
	const lines = (polite ? POLITE_REACTIONS : REACTIONS)[taste];
	return lines[Math.floor(roll * lines.length) % lines.length]!(item);
}

export const ALREADY_GIFTED = 'u already gave me something today. save it for tomorrow';
