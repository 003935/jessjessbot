export type DemoChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_TOTAL_LENGTH = 12_000;

export function validateDemoChat(value: unknown): DemoChatMessage[] | null {
	if (!value || typeof value !== 'object' || !('messages' in value)) return null;
	const messages = (value as { messages: unknown }).messages;
	if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES)
		return null;
	let totalLength = 0;
	const validMessages: DemoChatMessage[] = [];
	for (const item of messages) {
		if (!item || typeof item !== 'object') return null;
		const message = item as Record<string, unknown>;
		if (
			(message.role !== 'user' && message.role !== 'assistant') ||
			typeof message.content !== 'string' ||
			!message.content.trim() ||
			message.content.length > MAX_MESSAGE_LENGTH
		)
			return null;
		totalLength += message.content.length;
		if (totalLength > MAX_TOTAL_LENGTH) return null;
		validMessages.push({ role: message.role, content: message.content.trim() });
	}
	return validMessages;
}
