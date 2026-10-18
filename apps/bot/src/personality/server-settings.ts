import {
	ANNOYED_LINES,
	CHAT_FALLBACK,
	DEEPSEEK_DOWN_SCENARIOS,
	GREETING_LINES,
	LAZY_LINES,
	MEME_PROMPT,
} from '@repo/database/defaults';

// A server's canned lines from the dashboard; anything empty or malformed falls back to the default for that field only.

export type ServerSettings = {
	greetingLines: string[];
	annoyedLines: string[];
	lazyLines: string[];
	fallbackReply: string;
	downScenarios: Record<string, string[][]>;
	memeEnabled: boolean;
	memePrompt: string;
};

type CannedConfig = {
	bot_greeting_lines: string[];
	bot_annoyed_lines: string[];
	bot_lazy_lines: string[];
	bot_fallback_reply: string | null;
	bot_down_lines: unknown;
	bot_meme_enabled: boolean;
	bot_meme_prompt: string | null;
};

function lines(saved: string[], fallback: string[]): string[] {
	const cleaned = saved.map((line) => line.trim()).filter(Boolean);
	return cleaned.length ? cleaned : fallback;
}

function text(saved: string | null, fallback: string): string {
	return saved?.trim() ? saved.trim() : fallback;
}

function downScenarios(saved: unknown): Record<string, string[][]> {
	if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return DEEPSEEK_DOWN_SCENARIOS;
	const entries = Object.entries(saved as Record<string, unknown>);
	const valid =
		entries.length > 0 &&
		entries.every(
			([, stages]) =>
				Array.isArray(stages) &&
				stages.length > 0 &&
				stages.every(
					(stage) =>
						Array.isArray(stage) &&
						stage.length > 0 &&
						stage.every((line) => typeof line === 'string' && line.trim())
				)
		);
	return valid ? (saved as Record<string, string[][]>) : DEEPSEEK_DOWN_SCENARIOS;
}

export function resolveServerSettings(config: CannedConfig): ServerSettings {
	return {
		greetingLines: lines(config.bot_greeting_lines, GREETING_LINES),
		annoyedLines: lines(config.bot_annoyed_lines, ANNOYED_LINES),
		// The default lazy list deliberately includes '' (she just doesn't answer), so only saved lists are cleaned.
		lazyLines: lines(config.bot_lazy_lines, LAZY_LINES),
		fallbackReply: text(config.bot_fallback_reply, CHAT_FALLBACK),
		downScenarios: downScenarios(config.bot_down_lines),
		memeEnabled: config.bot_meme_enabled,
		memePrompt: text(config.bot_meme_prompt, MEME_PROMPT),
	};
}

export const DEFAULT_SERVER_SETTINGS: ServerSettings = resolveServerSettings({
	bot_greeting_lines: [],
	bot_annoyed_lines: [],
	bot_lazy_lines: [],
	bot_fallback_reply: null,
	bot_down_lines: null,
	bot_meme_enabled: true,
	bot_meme_prompt: null,
});
