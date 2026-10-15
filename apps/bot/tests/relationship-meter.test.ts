/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { applyInteraction, decayedScore, niceGain } =
	await import('../../../packages/database/src/tables/bot_relationship');
const { absencePrompt, feelingsPrompt } = await import('../src/modules/mention-relationship');

type State = Parameters<typeof applyInteraction>[0];
const DAY = 24 * 60 * 60 * 1000;
const start = new Date('2026-10-01T12:00:00Z');

/** Plays out messages: each entry is [day offset, mood]. Returns the state after each. */
function play(steps: Array<[number, -1 | 0 | 1]>, initial: State = null) {
	let state = initial;
	const scores: number[] = [];
	for (const [day, mood] of steps) {
		const now = new Date(start.getTime() + day * DAY);
		state = { ...applyInteraction(state, mood, now), updatedAt: now };
		scores.push(state.score / 10);
	}
	return { state: state!, scores };
}

test('each day of a nice streak is worth more than the last', () => {
	expect([1, 2, 3, 4, 5, 6, 7].map((streak) => niceGain(streak, 0))).toEqual([
		15, 23, 34, 51, 76, 90, 90,
	]);
	expect(niceGain(6, 600)).toBe(45);
});

test('being nice three times a day gets someone close in about a week', () => {
	const steps: Array<[number, 1]> = [];
	for (let day = 0; day < 7; day++) for (let i = 0; i < 4; i++) steps.push([day, 1]);
	const { state, scores } = play(steps);
	expect(state.niceStreak).toBe(7);
	// Only 3 nice messages a day count: the 4th on day 1 adds nothing.
	expect(scores.slice(0, 4)).toEqual([1.5, 3, 4.5, 4.5]);
	expect(scores[4 * 5 - 1]).toBeGreaterThan(50);
	expect(scores.at(-1)).toBeGreaterThan(80);
});

test('skipping a day resets the streak', () => {
	const { state } = play([
		[0, 1],
		[1, 1],
		[2, 1],
		[4, 1],
	]);
	expect(state.niceStreak).toBe(1);
});

test('meanness escalates within a day, caps at 30, and wipes the streak', () => {
	const { state, scores } = play([
		[0, 1],
		[1, 1],
		[1, -1],
		[1, -1],
		[1, -1],
		[1, -1],
		[1, -1],
	]);
	expect(scores.slice(2).map((score, i) => Math.round((score - scores[1]!) * 10) / 10)).toEqual([
		-3, -9, -21, -30, -30,
	]);
	expect(state.niceStreak).toBe(0);
});

test('going quiet pulls the meter back towards neutral, faster the longer they are gone', () => {
	const at = new Date('2026-10-01T00:00:00Z');
	const later = (days: number) => new Date(at.getTime() + days * DAY);
	expect(decayedScore(600, at, later(3))).toBe(600);
	expect(decayedScore(600, at, later(10))).toBe(530);
	expect(decayedScore(600, at, later(14))).toBe(450);
	expect(decayedScore(-300, at, later(14))).toBe(-150);
	expect(decayedScore(100, at, later(60))).toBe(0);
});

test('coming back after a while gets a reaction that fits how close they were', () => {
	expect(absencePrompt(70, 2)).toBeNull();
	expect(absencePrompt(70, 5)).toContain('missed them');
	expect(absencePrompt(30, 9)).toContain('over a week');
	expect(absencePrompt(30, 9)).toContain('look who remembered');
	expect(absencePrompt(-40, 20)).toContain('weeks');
	expect(absencePrompt(0, 4)).toContain('barely know them');
});

test('a long nice streak shows up when they ask how she feels', () => {
	expect(feelingsPrompt(40, 50, () => 0, 4)).toContain('sweet to you 4 days in a row');
	expect(feelingsPrompt(40, 50, () => 0, 1)).not.toContain('days in a row');
});
