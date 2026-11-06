// After someone calls jjb she keeps answering everyone in that channel for a while,
// and every reply pushes the end back, until it goes quiet or someone sends her away.
export const CONVERSATION_WINDOW_MS = 60_000;

const DISMISSAL =
	/^(?:(?:ok(?:ay)?|pls|please|jjb|jessjessbot)[,\s]+)*(?:shut\s*up|stfu|go\s*away|leave)(?:[,\s]+(?:jjb|jessjessbot|pls|please|now|already))*[\s!.?~]*$/iu;

const windows = new Map<string, number>();

export function extendConversationWindow(channelId: string, now = Date.now()): void {
	for (const [id, expiresAt] of windows) if (expiresAt <= now) windows.delete(id);
	windows.set(channelId, now + CONVERSATION_WINDOW_MS);
}

export function inConversationWindow(channelId: string, now = Date.now()): boolean {
	return (windows.get(channelId) ?? 0) > now;
}

export function closeConversationWindow(channelId: string): void {
	windows.delete(channelId);
}

export function isDismissal(text: string): boolean {
	return DISMISSAL.test(text.trim());
}
