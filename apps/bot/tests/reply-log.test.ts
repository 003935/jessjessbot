/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { avoidPrompt, lastReplyAt, logReply, recentReplies, staleParts } from '../src/modules/reply-log';

test('log keeps the last eight per channel', () => {
	for (let i = 0; i < 10; i++) logReply('c1', `reply ${i}`, 1000 + i);
	expect(recentReplies('c1', 2000)).toEqual(Array.from({ length: 8 }, (_, i) => `reply ${i + 2}`));
	expect(recentReplies('c2', 2000)).toEqual([]);
	expect(lastReplyAt('c1')).toBe(1009);
	expect(lastReplyAt('c2')).toBeNull();
});

test('replies older than six hours drop out', () => {
	logReply('c3', 'old one', 0);
	expect(recentReplies('c3', 6 * 60 * 60 * 1000 + 1)).toEqual([]);
});

test('stale opener and crutch phrase are detected', () => {
	expect(staleParts('oh ur alive. good, now eat', ['oh ur alive lol', 'whatever'])).toEqual([
		'opener:oh ur',
		'phrase:oh ur alive',
	]);
	expect(staleParts('in lint. they love lint', ['bc theyre landlords obviously'])).toEqual([]);
});

test('crutch phrases match whole words only', () => {
	expect(staleParts('that was a crimea joke', ['crime scene'])).toEqual([]);
});

test('avoid prompt is empty without history', () => {
	expect(avoidPrompt([])).toBe('');
	expect(avoidPrompt(['that cat is judging u'])).toContain('- that cat is judging u');
});
