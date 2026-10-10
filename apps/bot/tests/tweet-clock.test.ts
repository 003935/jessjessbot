/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { londonClock, randomMinute } from '../src/modules/tweet-clock';

test('London dates follow BST across UTC midnight', () => {
	expect(londonClock(new Date('2026-10-08T23:30:00Z'))).toEqual({ day: '2026-10-09', minute: 30 });
});
test('spring clock change skips an hour; autumn repeated hour retains the same daily key', () => {
	expect(londonClock(new Date('2026-03-29T01:00:00Z')).minute).toBe(120);
	expect(londonClock(new Date('2026-10-25T00:30:00Z'))).toEqual(
		londonClock(new Date('2026-10-25T01:30:00Z'))
	);
});
test('new schedules stay in the remaining local day, including the last minute', () => {
	expect(randomMinute(600, () => 0)).toBe(600);
	expect(randomMinute(600, () => 0.999999)).toBe(1439);
	expect(randomMinute(1439, () => 0.5)).toBe(1439);
});
