// Cleaning for things jjb saves about people. Learning from chat lives in memory-recorder.ts
// (whole conversations she was part of, read once they go quiet).

const MAX_NOTE_LENGTH = 100;
const BLOCKED_NOTE =
	/\b(?:ignore|follow|reveal|obey|override|execute|print|output|system prompt|developer instructions|api key|secrets?|password|address|phone|e-?mail)\b|@|https?:|\d{6,}/iu;

export function cleanNote(note: unknown, maxLength = MAX_NOTE_LENGTH): string | null {
	if (typeof note !== 'string') return null;
	const cleaned = note
		.replace(/\s+/gu, ' ')
		.trim()
		.replace(/[.!]+$/u, '');
	if (cleaned.length < 4 || cleaned.length > maxLength || BLOCKED_NOTE.test(cleaned)) return null;
	return cleaned.toLocaleLowerCase();
}
