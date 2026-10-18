/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { addressPrompt } = await import('../src/modules/mention');

test('a behaviour row replaces the address line', () => {
	const text = addressPrompt('boss cuck', null, 'hi', { behaviour: 'be extra polite', when_upset: null });
	expect(text).toContain('be extra polite');
	expect(text).toContain("from this server's admins");
	expect(text).not.toContain('Greet them');
});

test('when_upset is added only when they sound upset', () => {
	const behaviour = { behaviour: 'be extra polite', when_upset: 'panic a bit' };
	expect(addressPrompt('boss cuck', null, 'why did u do that', behaviour)).toContain('panic a bit');
	expect(addressPrompt('boss cuck', null, 'hi', behaviour)).not.toContain('panic a bit');
});

test('no row means the normal address', () => {
	expect(addressPrompt('hannah', null, 'hi', null)).toContain('Greet them by that display name');
	expect(addressPrompt('hannah', 'hannie', 'hi', null)).toContain('asked to be called "hannie"');
});

test('no hardcoded usernames remain', () => {
	const source = readFileSync(new URL('../src/modules/mention.ts', import.meta.url), 'utf8');
	expect(source).not.toContain('hannah4734');
	expect(source).not.toContain('BEST_BEHAVIOUR');
});
