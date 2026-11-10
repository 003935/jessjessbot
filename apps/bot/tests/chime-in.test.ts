/// <reference types="bun" />
import { expect, test } from 'bun:test';
import {
	ACTIVE_WINDOW_MS,
	LOOK_COOLDOWN_MS,
	LULL_MS,
	MAX_WAIT_MS,
	SPOKE_COOLDOWN_MS,
	cancelChimeIn,
	chatIsActive,
	markLooked,
	mayChimeIn,
	noteActivity,
	scheduleChimeIn,
} from '../src/modules/chime-in';

function busy(channelId: string, now = 0) {
	for (const [index, author] of ['a', 'b', 'a', 'b'].entries()) noteActivity(channelId, author, now + index);
}

test('one person talking to themselves is not an active chat', () => {
	for (let index = 0; index < 6; index++) noteActivity('solo', 'a', index);
	expect(chatIsActive('solo', 10)).toBe(false);
});

test('a few messages from two people is', () => {
	busy('busy');
	expect(chatIsActive('busy', 10)).toBe(true);
	expect(chatIsActive('busy', ACTIVE_WINDOW_MS + 10)).toBe(false);
});

test('she waits after speaking, and after deciding to stay quiet', () => {
	busy('cool');
	expect(mayChimeIn('cool', null, 10)).toBe(true);
	expect(mayChimeIn('cool', 0, 10)).toBe(false);
	expect(mayChimeIn('cool', -SPOKE_COOLDOWN_MS, 10)).toBe(true);
	markLooked('cool', 10);
	expect(mayChimeIn('cool', null, 20)).toBe(false);
	busy('cool', LOOK_COOLDOWN_MS + 10);
	expect(mayChimeIn('cool', null, LOOK_COOLDOWN_MS + 20)).toBe(true);
});

test('she waits for a lull, and each message pushes it back', async () => {
	let looks = 0;
	const start = Date.now();
	scheduleChimeIn('lull', () => looks++, start);
	scheduleChimeIn('lull', () => looks++, start);
	expect(looks).toBe(0);
	cancelChimeIn('lull');
	await Bun.sleep(5);
	expect(looks).toBe(0);
	expect(LULL_MS).toBeLessThan(MAX_WAIT_MS);
});

test('a chat that never pauses still gets a look', async () => {
	let looks = 0;
	scheduleChimeIn('nonstop', () => looks++, 0);
	// Long past the first message, so there is no wait left.
	scheduleChimeIn('nonstop', () => looks++, MAX_WAIT_MS);
	await Bun.sleep(5);
	expect(looks).toBe(1);
});
