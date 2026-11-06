import { Logger } from '@/utils';
import {
	DEFAULT_DISLIKES,
	DEFAULT_LIKES,
	FOOD_TASTES_DEFAULT,
	PERSONALITY_DEFAULT,
} from '@repo/database/defaults';
import type { BotVoice } from '@repo/database';

// jjb's global personality: the site admin's edit from the dashboard, or the default when there is none.
// Food tastes, likes and dislikes are fixed in code.

const logger = new Logger('Voice');
const VOICE_CACHE_MS = 60_000;

export type VoiceText = {
	personality: string;
	foodTastes: string;
	likes: string[];
	dislikes: string[];
};

export function resolveVoice(row: BotVoice | null): VoiceText {
	return {
		personality: row?.personality?.trim() || PERSONALITY_DEFAULT,
		foodTastes: FOOD_TASTES_DEFAULT,
		likes: DEFAULT_LIKES,
		dislikes: DEFAULT_DISLIKES,
	};
}

/** The opening of her system prompt. Ends with a blank line so the next section starts a new paragraph. */
export function buildVoicePrompt(voice: VoiceText): string {
	return `${voice.personality}\n\n`;
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
