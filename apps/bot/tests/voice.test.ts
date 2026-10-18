/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_LIKES } from '@repo/database/defaults';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { buildVoicePrompt, resolveVoice } = await import('../src/personality/voice');

// VOICE_PROMPT exactly as it was in mention.ts before it moved to the database.
const original = readFileSync(new URL('./fixtures/voice-prompt.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const paragraphs = (text: string) => text.replace(/\n+$/u, '').split('\n\n').sort();

const emptyRow = {
	id: 'global',
	identity: null,
	style: null,
	rules: null,
	examples: null,
	emoji: null,
	food_tastes: null,
	likes: [],
	dislikes: [],
	updatedBy: null,
	updatedAt: new Date(0),
};

test('default voice keeps every original paragraph once', () => {
	expect(paragraphs(buildVoicePrompt(resolveVoice(null)))).toEqual(paragraphs(original));
	expect(paragraphs(buildVoicePrompt(resolveVoice(emptyRow)))).toEqual(paragraphs(original));
});

test('an override replaces only its part', () => {
	const prompt = buildVoicePrompt(resolveVoice({ ...emptyRow, style: 'talk like a pirate' }));
	expect(prompt).toContain('talk like a pirate');
	expect(prompt).not.toContain('How you talk');
	expect(prompt).toContain('You are jessjessbot');
});

test('blank fields and empty lists fall back to the defaults', () => {
	const voice = resolveVoice({ ...emptyRow, identity: '   ', likes: [] });
	expect(voice.identity).toContain('You are jessjessbot');
	expect(voice.likes).toEqual(DEFAULT_LIKES);
});
