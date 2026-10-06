const BAIT_WINDOW_MS = 10 * 60 * 1000;
const recentBait = new Map<string, { count: number; lastAt: number }>();

export function isGroupBlameBait(prompt: string): boolean {
	return /^(?:ur wrong|you're wrong|you are wrong|fine|nah|no|actually)[\s,!.]+(?:the\s+)?(?:jews?|jewish people|chinese|muslims?|arabs?|immigrants?|migrants?|black people|white people|asian people|indians?|gay people|women)\s+(?:did it|(?:are|were) behind (?:it|everything)|(?:run|control) (?:everything|the world))\b/iu.test(
		prompt.trim()
	);
}

export function replyToGroupBlameBait(guildId: string, userId: string, prompt: string): string | null {
	if (!isGroupBlameBait(prompt)) return null;
	const now = Date.now();
	for (const [key, entry] of recentBait) {
		if (now - entry.lastAt > BAIT_WINDOW_MS) recentBait.delete(key);
	}
	const key = `${guildId}:${userId}`;
	const previous = recentBait.get(key);
	const count = previous && now - previous.lastAt <= BAIT_WINDOW_MS ? previous.count + 1 : 1;
	recentBait.set(key, { count, lastAt: now });
	if (count === 1) return 'nah, blaming a whole group for that isn’t a point. ask me a real question.';
	if (count === 2) return 'u pmo i dont want to say';
	return 'same bit again? boring.';
}
