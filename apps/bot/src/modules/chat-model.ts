// Which chat API and model jjb talks to, and how hard the model thinks per task.
// Defaults keep the old DeepSeek setup; set CHAT_* variables to use any
// OpenAI-compatible API instead (e.g. an OpenCode Go subscription).

/** quick: everyday banter. deep: images, links, long answers, search results, recaps. */
export type ChatTier = 'quick' | 'deep';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export function chatUrl(): string {
	return process.env.CHAT_API_URL || DEEPSEEK_URL;
}

export function chatApiKey(): string | undefined {
	return process.env.CHAT_API_KEY || process.env.DEEPSEEK_API_KEY || undefined;
}

/**
 * Request headers. OpenCode Go rejects requests without a stable per-conversation
 * session ID and asks clients to send their own user agent.
 */
export function chatHeaders(apiKey: string, sessionId: string): Record<string, string> {
	return {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
		'User-Agent': 'jessjessbot/1.0',
		'x-opencode-session': `jjb-${sessionId}`,
	};
}

export function chatModel(tier: ChatTier, hasImages = false): string {
	const quick = process.env.CHAT_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-flash';
	const deep = process.env.CHAT_DEEP_MODEL || quick;
	if (hasImages) return process.env.CHAT_VISION_MODEL || deep;
	return tier === 'deep' ? deep : quick;
}

/** "off" (or unset for quick) turns reasoning off; otherwise low, medium, or high. */
export function reasoningEffort(tier: ChatTier): string | null {
	const configured =
		tier === 'deep'
			? (process.env.CHAT_DEEP_REASONING_EFFORT ?? 'medium')
			: (process.env.CHAT_REASONING_EFFORT ?? 'off');
	const effort = configured.trim().toLocaleLowerCase();
	return effort && effort !== 'off' && effort !== 'none' ? effort : null;
}

/**
 * Model, reasoning, and sampling fields for a request. DeepSeek's own API takes
 * `thinking`; other OpenAI-compatible APIs take `reasoning_effort`. Pass
 * reasoning=false to force it off, e.g. when a model rejected the reasoning fields.
 */
export function chatRequestFields(
	tier: ChatTier,
	options: { hasImages?: boolean; temperature?: number; maxTokens: number; reasoning?: boolean; penalties?: boolean }
): Record<string, unknown> {
	const effort = options.reasoning === false ? null : reasoningEffort(tier);
	const deepSeek = chatUrl() === DEEPSEEK_URL;
	return {
		model: chatModel(tier, options.hasImages),
		...(deepSeek ? { thinking: { type: effort ? 'enabled' : 'disabled' } } : {}),
		...(effort && !deepSeek ? { reasoning_effort: effort } : {}),
		// Thinking models mostly ignore or reject temperature, so only send it without reasoning.
		...(effort || options.temperature === undefined ? {} : { temperature: options.temperature }),
		// Chat replies recycle the same words ("noted", "fine.") without these; thinking models ignore them.
		...(effort || !options.penalties ? {} : { frequency_penalty: 0.4, presence_penalty: 0.3 }),
		// Thinking tokens count towards max_tokens, so leave room for them.
		max_tokens: effort ? options.maxTokens + 4000 : options.maxTokens,
	};
}
