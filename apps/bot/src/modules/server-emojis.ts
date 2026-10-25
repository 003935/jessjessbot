import type { Guild, GuildEmoji } from 'discord.js';

const CACHE_MS = 15 * 60_000;
const cached = new Map<string, { expiresAt: number; emojis: GuildEmoji[] }>();

const MOOD_WORDS: Array<{ test: RegExp; emojiNames: RegExp }> = [
	{ test: /\b(?:lol|lmao|lmfao|laugh|funny|hilarious|joke)\b/iu, emojiNames: /laugh|lol|kek|giggle|xd/iu },
	{ test: /\b(?:sad|sorry|cry|weep|weh|hurt)\b/iu, emojiNames: /sad|cry|sob|weep/iu },
	{ test: /\b(?:wow|wowie|what|omg|shocked|no way)\b/iu, emojiNames: /wow|shock|surpris|pog/iu },
	{ test: /\b(?:love|cute|sweet|kitten|cat)\b/iu, emojiNames: /love|heart|cute|kitten|cat/iu },
	{ test: /\b(?:angry|mad|hmph|annoyed|bruh)\b/iu, emojiNames: /angry|mad|hmph|rage|bruh/iu },
];

async function usableEmojis(guild: Guild): Promise<GuildEmoji[]> {
	const entry = cached.get(guild.id);
	if (entry && entry.expiresAt > Date.now()) return entry.emojis;
	const [emojis, me] = await Promise.all([guild.emojis.fetch(), guild.members.fetchMe()]);
	const usable = [...emojis.values()].filter(
		(emoji) =>
			emoji.available &&
			(emoji.roles.cache.size === 0 ||
				emoji.roles.cache.some((role) => me.roles.cache.has(role.id)))
	);
	cached.set(guild.id, { expiresAt: Date.now() + CACHE_MS, emojis: usable });
	return usable;
}

/** "bcaBugcatSomberCry" -> bca, bugcat, somber, cry. A message word has to be one of these, not just appear inside the name. */
export function emojiMatchesWord(emojiName: string, word: string): boolean {
	const parts = emojiName
		.replace(/([a-z])([A-Z])/gu, '$1 $2')
		.toLocaleLowerCase()
		.split(/[^a-z]+/u)
		.filter(Boolean);
	return parts.includes(word.toLocaleLowerCase());
}

// Tacked on after the punchline every time, a server emoji becomes part of the reply's shape, so it is rare.
const EMOJI_CHANCE = 0.1;

export async function withServerEmoji(
	guild: Guild,
	reply: string,
	prompt: string,
	random: () => number = Math.random
): Promise<string> {
	if (/\b(?:suicid\w*|self.harm|abuse|assault|grief|died|death|hospital|fired|unemployed|depress\w*)\b/iu.test(prompt))
		return reply;
	if (random() >= EMOJI_CHANCE || /<a?:\w+:\d+>/u.test(reply)) return reply;
	if (/[\u{1F300}-\u{1FAFF}]/u.test(reply) || /\([^)]{0,25}[^\x20-\x7e][^)]{0,25}\)/u.test(reply))
		return reply;

	const emojis = await usableEmojis(guild);
	const words = new Set(
		`${prompt} ${reply}`
			.toLocaleLowerCase()
			.match(/[a-z]{3,}/gu)
			?.filter((word) => !['the', 'and', 'that', 'this', 'with', 'from', 'have', 'what'].includes(word)) ?? []
	);
	const matchingMoods = MOOD_WORDS.filter(({ test }) => test.test(`${prompt} ${reply}`));
	const ranked = emojis
		.map((emoji) => {
			const name = emoji.name?.toLocaleLowerCase() ?? '';
			const relevantWord = [...words].some((word) => emojiMatchesWord(emoji.name ?? '', word));
			const relevantMood = matchingMoods.some(({ emojiNames }) => emojiNames.test(name));
			return { emoji, score: Number(relevantWord) * 2 + Number(relevantMood) };
		})
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score);
	if (!ranked.length) return reply;
	const highestScore = ranked[0]!.score;
	const top = ranked.filter(({ score }) => score === highestScore);
	const chosen = top[Math.floor(random() * top.length)]!.emoji;
	return `${reply} ${chosen.toString()}`;
}
