import { db } from '@/db';

const repeatWindowMs = 10 * 60 * 1000;
const recentShifts = new Map<string, number>();

export function attitudeShift(input: string): -1 | 0 | 1 {
	const text = input
		.replace(/```[\s\S]*?```/gu, '')
		.replace(/[\u200B-\u200D\uFEFF]/gu, '')
		.toLocaleLowerCase()
		.slice(0, 500);
	if (/\b(?:you|u)\s+(?:are|r)\s+not\s+(?:useless|stupid|dumb|boring|annoying|bad)\b/iu.test(text))
		return 0;
	const nice =
		/\b(?:thank\s*(?:you|u)|thanks|ty|good bot|well done|love (?:you|u)|appreciate (?:you|u)|(?:you|u)\s+(?:are|r)\s+(?:cute|great|amazing|helpful|smart|funny|the best))\b/iu.test(
			text
		);
	const mean =
		/\b(?:bad bot|stupid bot|useless bot|shut up|i hate (?:you|u)|(?:you|u)\s+(?:are|r)\s+(?:useless|stupid|dumb|boring|annoying|bad))\b/iu.test(
			text
		);
	return nice === mean ? 0 : nice ? 1 : -1;
}

export async function relationshipState(
	guildId: string,
	userId: string,
	prompt: string
): Promise<{ score: number; lastInteractedAt: Date | null }> {
	const shift = attitudeShift(prompt);
	const now = Date.now();
	for (const [key, time] of recentShifts) {
		if (now - time >= repeatWindowMs) recentShifts.delete(key);
	}
	const key = `${guildId}:${userId}:${prompt.toLocaleLowerCase().trim().replace(/\s+/gu, ' ')}`;
	const delta = shift && (recentShifts.get(key) ?? 0) <= now - repeatWindowMs ? shift : 0;
	const state = await db.botRelationship.interact(guildId, userId, delta);
	if (delta) recentShifts.set(key, now);
	return state;
}

export function relationshipTone(score: number, cute = false, reunion = false): string {
	if (score <= -2)
		return 'This person has been rude to you recently. In casual banter, be a little prickly and answer with dry, short comebacks. You still help with real requests and respond kindly to distress. Never be cruel, harass them, or reveal a score.';
	if (score >= 3)
		return `This person has built a close, friendly relationship with you. Be noticeably kinder and more affectionate, while keeping the answer useful and natural. ${cute ? 'For this reply, let one cute touch through if it fits: a gentle pet name like bun or honey, hewwooo as a greeting, sowwie for an actual apology, or yippie/yayy for excitement. Choose at most one and do not use girlie.' : 'Keep the wording natural this time; no pet name or baby talk is needed.'} ${reunion ? 'This person is greeting you after more than a day away. Open with a brief, warm missed-you line such as "omg ive missed u", then respond to what they said.' : ''} Never mention a score.`;
	if (score >= 1)
		return 'This person has been kind to you. Sound a little warmer, though you may pretend to be reluctantly pleased. Keep nicknames and cutesy spelling rare. Do not reveal a score.';
	return 'Default mood: lightly tsundere. Dry, a bit of pretend reluctance, but you still answer. Do not reveal a score.';
}

export function isReunion(
	lastInteractedAt: Date | null,
	now: Date,
	prompt: string,
	score: number
): boolean {
	return (
		score >= 3 &&
		lastInteractedAt !== null &&
		now.getTime() - lastInteractedAt.getTime() > 24 * 60 * 60 * 1000 &&
		/^(?:hi+|he+y+|hello+|yo+|im back|i'm back|miss(?:ed)? (?:me|u|you)|how are (?:u|you))\b/iu.test(prompt.trim())
	);
}
