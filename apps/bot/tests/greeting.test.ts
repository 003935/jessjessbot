/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { addressPrompt, dropUnaskedGreeting } = await import('../src/modules/mention');

test('she addresses them by display name or the nickname they asked for', () => {
	expect(addressPrompt('hannah', null, 'hi')).toContain('greet them back as that display name');
	expect(addressPrompt('hannah', 'hannie', 'hi')).toContain('asked to be called "hannie"');
});

test('she only greets when they said hi', () => {
	expect(addressPrompt('donkeyboy', null, 'jjb hiii')).toContain('greet them back');
	for (const prompt of ['gn', 'jjb gn', 'what is the time', 'high score?']) {
		const text = addressPrompt('donkeyboy', 'donk', prompt);
		expect(text).not.toContain('greet them back');
		expect(text).toContain('do not open with a hello');
		expect(text).toContain('call them "donk"');
	}
});

test('an unasked hello is cut from the reply', () => {
	const names = ['donkeyboy', null, 'donkeyboy123'];
	expect(dropUnaskedGreeting('hiii donkeyboy, gn sleep well', 'gn', names)).toBe('gn sleep well');
	expect(dropUnaskedGreeting('hey donkeyboy123 gn', 'gn', names)).toBe('gn');
	expect(dropUnaskedGreeting('hii! its 3am go to bed', 'what time is it', names)).toBe('its 3am go to bed');
	expect(dropUnaskedGreeting('hiii donkeyboy', 'gn', names)).toBe('hiii donkeyboy');
	expect(dropUnaskedGreeting('hey that is wild', 'look at this', names)).toBe('hey that is wild');
	expect(dropUnaskedGreeting('hiii donkeyboy, missed u', 'hiii', names)).toBe('hiii donkeyboy, missed u');
});

test('no hardcoded usernames remain', () => {
	const source = readFileSync(new URL('../src/modules/mention.ts', import.meta.url), 'utf8');
	expect(source).not.toContain('hannah4734');
	expect(source).not.toContain('BEST_BEHAVIOUR');
});
