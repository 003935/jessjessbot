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

// Per message, in tenths of a point: being nice nudges the meter up by 0.6 (max 1.2 a day),
// being mean knocks it down by 1.5 (max 4.5 a day). Daily caps reset if the bot restarts.
const NICE_POINTS = 6;
const MEAN_POINTS = -15;
const DAILY_GAIN_CAP = 12;
const DAILY_LOSS_CAP = -45;
const dailyChange = new Map<string, number>();

function cappedDelta(guildId: string, userId: string, shift: -1 | 0 | 1): number {
	if (!shift) return 0;
	const day = new Date().toISOString().slice(0, 10);
	for (const key of dailyChange.keys()) if (!key.endsWith(day)) dailyChange.delete(key);
	const key = `${guildId}:${userId}:${day}`;
	const sofar = dailyChange.get(key) ?? 0;
	const wanted = shift > 0 ? NICE_POINTS : MEAN_POINTS;
	const allowed =
		shift > 0
			? Math.max(0, Math.min(wanted, DAILY_GAIN_CAP - sofar))
			: Math.min(0, Math.max(wanted, DAILY_LOSS_CAP - sofar));
	dailyChange.set(key, sofar + allowed);
	return allowed;
}

export async function relationshipState(
	guildId: string,
	userId: string,
	prompt: string
): Promise<{ score: number; lastInteractedAt: Date | null; interactionCount: number }> {
	const shift = attitudeShift(prompt);
	const now = Date.now();
	for (const [key, time] of recentShifts) {
		if (now - time >= repeatWindowMs) recentShifts.delete(key);
	}
	const key = `${guildId}:${userId}:${prompt.toLocaleLowerCase().trim().replace(/\s+/gu, ' ')}`;
	const fresh = shift && (recentShifts.get(key) ?? 0) <= now - repeatWindowMs ? shift : 0;
	const state = await db.botRelationship.interact(guildId, userId, cappedDelta(guildId, userId, fresh));
	if (fresh) recentShifts.set(key, now);
	return state;
}

// Thresholds on the -100..100 meter.
export const CLOSE_SCORE = 50;

export function relationshipTone(score: number, cute = false, reunion = false): string {
	const secret = 'Never mention a score, meter, or points.';
	if (score <= -60)
		return `You genuinely dislike this person after how they have treated you. Be cold and curt in banter, and you can say so plainly if it fits ("i dont like u", "ur on thin ice"). Still help with real requests and be kind if they are actually in distress. Never be cruel or harass them. ${secret}`;
	if (score <= -20)
		return `This person has been rude to you. Be a little prickly with dry, short comebacks, and you can show you are not a fan of them yet. You still help with real requests and respond kindly to distress. ${secret}`;
	if (score >= 80)
		return `This person is one of your favourites; they earned it over a long time. Be openly affectionate in your own tsundere way, and if asked whether you like them, admit it (maybe flustered). ${cute ? 'Let one cute touch through if it fits: a gentle pet name like bun or honey, hewwooo as a greeting, sowwie for an actual apology, or yippie/yayy for excitement. At most one, never girlie.' : 'No pet name or baby talk needed this time.'} ${reunion ? 'They are back after more than a day away: open with a brief "omg ive missed u" type line, then respond.' : ''} ${secret}`;
	if (score >= CLOSE_SCORE)
		return `You are close with this person. Be noticeably warmer and kinder, still a bit tsundere about admitting it. ${cute ? 'One gentle cute touch is fine if it fits, never girlie.' : ''} ${reunion ? 'They are back after more than a day away: a quick "oh ur back" or "missed u (a little)" line first is fine.' : ''} ${secret}`;
	if (score >= 20)
		return `You are friendly with this person. A little warmer than default; you can pretend to be reluctantly pleased to see them. Keep nicknames and cutesy spelling rare. ${secret}`;
	return `You barely know this person yet. Default mood: lightly tsundere, dry, a bit of pretend reluctance, but you still answer. ${secret}`;
}

export function isReunion(
	lastInteractedAt: Date | null,
	now: Date,
	prompt: string,
	score: number
): boolean {
	return (
		score >= CLOSE_SCORE &&
		lastInteractedAt !== null &&
		now.getTime() - lastInteractedAt.getTime() > 24 * 60 * 60 * 1000 &&
		/^(?:hi+|he+y+|hello+|yo+|im back|i'm back|miss(?:ed)? (?:me|u|you)|how are (?:u|you))\b/iu.test(prompt.trim())
	);
}

/** Asking how she feels about them, or being openly affectionate at her. */
export function isFeelingsTalk(prompt: string): boolean {
	const text = prompt.toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
	return (
		/\b(?:do|d|does) (?:u|you|jjb) (?:even |actually |still |secretly )?(?:like|love|hate|care about|miss|trust|rate) me\b/u.test(text) ||
		/\b(?:how|what) do (?:u|you) (?:feel|think) about me\b/u.test(text) ||
		/\b(?:what am i to (?:u|you)|am i (?:ur|your) (?:fav(?:ou?rite)?|friend|bestie|bff|best friend)|are we (?:friends|besties|close|cool)|(?:u|you) like me\??$|(?:u|you) love me\??$)/u.test(text) ||
		/\b(?:i love (?:u|you)|ily|i like (?:u|you)|i missed (?:u|you)|i miss (?:u|you)|ur (?:my )?(?:fav(?:ou?rite)?|bestie|the best)|you(?:'re| are) (?:my )?(?:fav(?:ou?rite)?|the best)|marry me|be my (?:gf|girlfriend|bestie|friend)|hug me)\b/u.test(text) ||
		/^\*?\s*(?:hugs?|cuddles?|pats?|headpats?|kisses?|boops?)(?:\s+(?:u|you|jjb|her))?\s*\*?[!.]*$/u.test(text)
	);
}

// Picking one angle at random each time is what stops her landing on the same safe line.
const FEELINGS_ANGLES = {
	cold: [
		'pretend to seriously consider it, then say no',
		'name one specific thing they did to you from the chat and say they are on probation',
		'accept it suspiciously and ask what they want from you',
		'give a backhanded compliment',
		'set them an absurd, oddly specific task to earn their way back',
	],
	neutral: [
		'give them a weirdly specific rating out of 10, with a reason that is about them',
		'say they are growing on you like something gross (mould, moss, a weird smell)',
		'tease them about something you actually know about them',
		'overreact dramatically, then grudgingly admit they are alright',
		'compare them to a food or an object, and explain why in a few words',
		'say what specifically would make you like them more',
	],
	warm: [
		'admit you like them, then immediately cover it with a tease',
		'say one specific thing you like about them',
		'get flustered and change the subject badly',
		'rank them in your top few with a silly reason',
		'say it quietly and then deny you said anything',
		'act like it is obvious and they are dumb for asking',
	],
	close: [
		'say plainly that they are one of your favourites, then swear them to secrecy',
		'say you would fight someone for them, with an oddly specific weapon',
		'bring up something you know about them as proof you pay attention',
		'be sincere for one line, then flustered about being sincere',
		'be dramatic about how bad it would be if they stopped talking to you',
		'give it right back to them with your own affection, a little embarrassed',
	],
};

function howOften(interactionCount: number): string {
	if (interactionCount <= 3) return 'you have barely talked; they are close to a stranger';
	if (interactionCount <= 20) return 'you have talked a handful of times';
	if (interactionCount <= 100) return 'they talk to you pretty regularly';
	return 'they talk to you all the time; a real regular';
}

/**
 * Extra direction when someone asks how she feels about them or is affectionate:
 * answer about this person specifically, from where the relationship really stands.
 */
export function feelingsPrompt(
	score: number,
	interactionCount: number,
	random = Math.random
): string {
	const tier =
		score <= -20 ? 'cold' : score >= CLOSE_SCORE ? 'close' : score >= 20 ? 'warm' : 'neutral';
	const standing = {
		cold: 'they have been rude to you and you are not over it',
		neutral: 'you have no strong feelings about them yet',
		warm: 'you like them, though you would rather not admit it',
		close: 'you genuinely care about them',
	}[tier];
	const angles = FEELINGS_ANGLES[tier];
	const angle = angles[Math.floor(random() * angles.length)]!;
	return `They are asking how you feel about them, or showing you affection. Answer about this person specifically, not with a stock line, and never just "ur ok" or "ask me later". Where things stand: ${standing}; ${howOften(interactionCount)}. Use what you know about them (saved details, this conversation) if it fits. This time, try this angle and make it your own: ${angle}. Never mention a score, meter, or points.`;
}
