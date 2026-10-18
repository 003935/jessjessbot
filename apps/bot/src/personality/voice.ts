import { Logger } from '@/utils';
import {
	DEFAULT_DISLIKES,
	DEFAULT_LIKES,
	FOOD_TASTES_DEFAULT,
	VOICE_DEFAULTS,
} from '@repo/database/defaults';
import type { BotVoice } from '@repo/database';

// jjb's global voice: the site admin's edits from the dashboard, falling back to the defaults field by field.

const logger = new Logger('Voice');
const VOICE_CACHE_MS = 60_000;

export type VoiceText = {
	identity: string;
	style: string;
	rules: string;
	examples: string;
	emoji: string;
	foodTastes: string;
	likes: string[];
	dislikes: string[];
};

function text(value: string | null | undefined, fallback: string): string {
	return value?.trim() ? value.trim() : fallback;
}

function list(value: string[] | null | undefined, fallback: string[]): string[] {
	const cleaned = (value ?? []).map((item) => item.trim()).filter(Boolean);
	return cleaned.length ? cleaned : fallback;
}

export function resolveVoice(row: BotVoice | null): VoiceText {
	return {
		identity: text(row?.identity, VOICE_DEFAULTS.identity),
		style: text(row?.style, VOICE_DEFAULTS.style),
		rules: text(row?.rules, VOICE_DEFAULTS.rules),
		examples: text(row?.examples, VOICE_DEFAULTS.examples),
		emoji: text(row?.emoji, VOICE_DEFAULTS.emoji),
		foodTastes: text(row?.food_tastes, FOOD_TASTES_DEFAULT),
		likes: list(row?.likes, DEFAULT_LIKES),
		dislikes: list(row?.dislikes, DEFAULT_DISLIKES),
	};
}

/** The opening of her system prompt. Ends with a blank line so the next section starts a new paragraph. */
export function buildVoicePrompt(voice: VoiceText): string {
	return `${[voice.identity, voice.style, voice.rules, voice.examples, voice.emoji].join('\n\n')}\n\n`;
}

let cached: { expiresAt: number; voice: VoiceText } | null = null;

export async function getVoice(): Promise<VoiceText> {
	if (cached && cached.expiresAt > Date.now()) return cached.voice;
	// Loaded lazily so importing the voice helpers never needs a database connection.
	const row = await import('@/db')
		.then(({ db }) => db.botVoice.get())
		.catch((error: unknown) => {
			logger.error('Could not load bot voice', error);
			return null;
		});
	const voice = resolveVoice(row);
	cached = { expiresAt: Date.now() + VOICE_CACHE_MS, voice };
	return voice;
}
