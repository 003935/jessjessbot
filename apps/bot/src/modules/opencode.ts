// OpenCode Go subscription: OpenAI-compatible Chat Completions.
// https://opencode.ai/v2/docs/console/go/
export const OPENCODE_CHAT_URL = 'https://opencode.ai/inference/go/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-v4.1-flash';

export function opencodeModel(): string {
	return process.env.OPENCODE_MODEL || DEFAULT_MODEL;
}

// Go rejects requests without a stable per-conversation session ID and asks
// clients to identify themselves with their own user agent.
export function opencodeHeaders(apiKey: string, sessionId: string): Record<string, string> {
	return {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
		'User-Agent': 'jessjessbot/1.0',
		'x-opencode-session': `jjb-${sessionId}`,
	};
}

// DeepSeek models think by default, which eats small max_tokens budgets.
// Other model families reject the field, so only send it to DeepSeek.
export function noThinking(model: string): { thinking?: { type: 'disabled' } } {
	return model.startsWith('deepseek') ? { thinking: { type: 'disabled' } } : {};
}
