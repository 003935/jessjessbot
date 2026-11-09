// jjb joins a busy chat on her own, without answering every message. She waits for a
// lull, takes one look at what people are saying, and only posts if she has something
// to add. Her chime-ins are plain channel messages, not replies, so nobody gets pinged.

/** How far back counts as "people are talking right now". */
export const ACTIVE_WINDOW_MS = 3 * 60_000;
export const MIN_MESSAGES = 4;
export const MIN_SPEAKERS = 2;
/** She waits for this much quiet before looking, so she isn't answering mid-typing. */
export const LULL_MS = 12_000;
/** A chat that never pauses still gets a look after this long. */
export const MAX_WAIT_MS = 45_000;
/** After she said anything in a channel, chimed in or answered someone. */
export const SPOKE_COOLDOWN_MS = 4 * 60_000;
/** After she looked and had nothing to say. */
export const LOOK_COOLDOWN_MS = 2 * 60_000;

const activity = new Map<string, Array<{ authorId: string; at: number }>>();
const lastLook = new Map<string, number>();
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; since: number }>();

export function noteActivity(channelId: string, authorId: string, now = Date.now()): void {
	const recent = (activity.get(channelId) ?? []).filter((entry) => now - entry.at < ACTIVE_WINDOW_MS);
	recent.push({ authorId, at: now });
	activity.set(channelId, recent);
}

export function chatIsActive(channelId: string, now = Date.now()): boolean {
	const recent = (activity.get(channelId) ?? []).filter((entry) => now - entry.at < ACTIVE_WINDOW_MS);
	return recent.length >= MIN_MESSAGES && new Set(recent.map((entry) => entry.authorId)).size >= MIN_SPEAKERS;
}

export function mayChimeIn(channelId: string, lastSpokeAt: number | null, now = Date.now()): boolean {
	if (lastSpokeAt !== null && now - lastSpokeAt < SPOKE_COOLDOWN_MS) return false;
	if (now - (lastLook.get(channelId) ?? -Infinity) < LOOK_COOLDOWN_MS) return false;
	return chatIsActive(channelId, now);
}

export function markLooked(channelId: string, now = Date.now()): void {
	lastLook.set(channelId, now);
}

/**
 * Runs `look` once the channel goes quiet for LULL_MS. Each new message pushes it back,
 * up to MAX_WAIT_MS after the first one.
 */
export function scheduleChimeIn(channelId: string, look: () => void, now = Date.now()): void {
	const waiting = pending.get(channelId);
	if (waiting) clearTimeout(waiting.timer);
	const since = waiting?.since ?? now;
	const delay = Math.max(0, Math.min(LULL_MS, since + MAX_WAIT_MS - now));
	const timer = setTimeout(() => {
		pending.delete(channelId);
		look();
	}, delay);
	pending.set(channelId, { timer, since });
}

/** Someone talked to her directly, so a chime-in right after would be a double reply. */
export function cancelChimeIn(channelId: string): void {
	const waiting = pending.get(channelId);
	if (waiting) clearTimeout(waiting.timer);
	pending.delete(channelId);
}
