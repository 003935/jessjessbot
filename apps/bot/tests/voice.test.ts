/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
	DEFAULT_DISLIKES,
	DEFAULT_LIKES,
	FOOD_TASTES_DEFAULT,
	PERSONALITY_DEFAULT,
	PERSONALITY_LIMITS,
} from '@repo/database/defaults';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { buildVoicePrompt, resolveVoice } = await import('../src/personality/voice');

// VOICE_PROMPT exactly as it was in mention.ts before it moved to the database.
const original = readFileSync(new URL('./fixtures/voice-prompt.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const paragraphs = (text: string) => text.replace(/\n+$/u, '').split('\n\n').sort();

const emptyRow = { id: 'global', personality: null, updatedBy: null, updatedAt: new Date(0) };

test('default personality keeps every original paragraph once', () => {
	expect(paragraphs(buildVoicePrompt(resolveVoice(null)))).toEqual(paragraphs(original));
	expect(paragraphs(buildVoicePrompt(resolveVoice(emptyRow)))).toEqual(paragraphs(original));
});

test('a saved personality replaces the whole default', () => {
	expect(buildVoicePrompt(resolveVoice({ ...emptyRow, personality: 'talk like a pirate' }))).toBe(
		'talk like a pirate\n\n'
	);
});

test('a blank saved personality falls back to the default', () => {
	expect(resolveVoice({ ...emptyRow, personality: '   ' }).personality).toBe(PERSONALITY_DEFAULT);
});

test('likes, dislikes and food tastes always come from code', () => {
	const voice = resolveVoice({ ...emptyRow, personality: 'x' });
	expect(voice.likes).toEqual(DEFAULT_LIKES);
	expect(voice.dislikes).toEqual(DEFAULT_DISLIKES);
	expect(voice.foodTastes).toBe(FOOD_TASTES_DEFAULT);
});

test('default voice teaches calm short replies, rare faces, bits and photo corrections', () => {
	const prompt = buildVoicePrompt(resolveVoice(null));
	expect(prompt).toContain('usually 1 or 2 short lines');
	expect(prompt).toContain('a rare treat, not a habit');
	expect(prompt).not.toMatch(/[–—]/u);
	expect(prompt).toContain('NEVER say "load bearing"');
	expect(prompt).toContain('a bit is something you add to an answer, never a reason not to answer');
	expect(prompt).toContain('misread their photo');
	expect(prompt).toContain('no assistant phrasing');
	expect(prompt).toContain('accurate when you present it as real information');
	expect(prompt).not.toMatch(/great question|i hope this helps|ok first of all/u);
	expect(resolveVoice(null).personality.length).toBeLessThanOrEqual(PERSONALITY_LIMITS.personality);
});
