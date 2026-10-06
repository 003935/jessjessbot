export function isRecapRequest(prompt: string): boolean {
	const text = prompt.trim().toLocaleLowerCase();
	if (/\b(?:tl;?dr|catch me up|what did i miss)\b/u.test(text)) return true;
	if (/\b(?:give me|show me)\b.*\bhighlights\b.*\b(?:chat|channel|conversation|messages?|here)\b/u.test(text)) return true;
	if (!/\b(?:recap|summari[sz]e|summary)\b/u.test(text)) return false;
	return /\b(?:chat|channel|conversation|messages?|here)\b/u.test(text) ||
		/\b(?:past|last)\s+(?:\d+\s*)?(?:minutes?|mins?|hours?|days?)\b/u.test(text) ||
		/^(?:recap|summary|summari[sz]e)(?:\s+(?:please|me))?[.!?]*$/u.test(text);
}

export function isEventSetupRequest(prompt: string): boolean {
	const text = prompt.trim().toLocaleLowerCase();
	return /\b(?:set\s*up|schedule|create|host|organise|organize|plan|start|make|run|do|have)\b/u.test(text) &&
		/\b(?:customs?|game\s*nights?|events?|tournaments?|scrims?|signups?)\b/u.test(text);
}

export function isWordleLeaderboardRequest(prompt: string, replyingToWordle = false): boolean {
	const text = prompt.toLocaleLowerCase();
	return (/\bwordle\b/u.test(text) || replyingToWordle) && /\b(?:leaderboard|ranking|rank|top|king|winning)\b/u.test(text);
}

export function isWordleWinsRequest(prompt: string, replyingToWordle = false): boolean {
	const text = prompt.toLocaleLowerCase();
	return (/\bwordle\b/u.test(text) || replyingToWordle) && /\bwins?\b/u.test(text) &&
		/\b(?:my|mine|i|me|have|how many|check|show)\b/u.test(text);
}

export function isRandomMemberRequest(prompt: string): boolean {
	return /^(?:pick|choose|select|name)\s+(?:me\s+)?(?:a\s+)?random\s+(?:person|member|user)(?:\s+(?:from|in)\s+(?:this|the|our)?\s*server)?[.!?]*$/iu.test(prompt.trim());
}

export function allowsLongChatReply(prompt: string): boolean {
	return /\b(?:recipe|ingredients|instructions|step(?:s)?[ -]by[ -]step|in[ -]depth|detailed|detail|thorough|explain fully|walk me through|write (?:a |an )?(?:poem|story|essay))\b/iu.test(prompt);
}

export function limitChatReply(reply: string, prompt: string): string {
	if (allowsLongChatReply(prompt))
		return reply.replace(/[ \t]+/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim().slice(0, 800);
	const oneLine = reply.replace(/\s+/gu, ' ').trim();
	if (oneLine.length <= 500) return oneLine;
	const leading = oneLine.slice(0, 501);
	const sentenceEnds = [...leading.matchAll(/[.!?]+(?=\s|$)/gu)]
		.map((match) => match.index! + match[0].length)
		.filter((index) => index >= 200 && index <= 500);
	const lastSentence = sentenceEnds.at(-1);
	if (lastSentence) return oneLine.slice(0, lastSentence).trim();
	const lastSpace = leading.lastIndexOf(' ', 500);
	return `${oneLine.slice(0, lastSpace > 200 ? lastSpace : 500).trimEnd()}…`;
}
