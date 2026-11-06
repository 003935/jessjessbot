/// <reference types="bun" />
import { expect, mock, setSystemTime, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { addressPrompt, datePrompt, dropFollowUpQuestion, keepsResultOnRepeat, rareCasualLine, shouldRetryForRepeats } = await import('../src/modules/mention');
const { ANNOYED_LINES, LAZY_LINES } = await import('@repo/database/defaults');

test('generic chat-extender questions are cut', () => {
	expect(dropFollowUpQuestion('sushi obviously. pizza is for quitters. what about u?')).toBe(
		'sushi obviously. pizza is for quitters.'
	);
	expect(dropFollowUpQuestion('fair enough, long day huh. what are u up to tonight?')).toBe(
		'fair enough, long day huh.'
	);
});

test('in-bit questions are kept', () => {
	expect(dropFollowUpQuestion('thats a lot of money for a sandwich. who paid u?')).toBe(
		'thats a lot of money for a sandwich. who paid u?'
	);
	expect(dropFollowUpQuestion('bold claim from a nilah player. is choco a fat latina? u tell me')).toBe(
		'bold claim from a nilah player. is choco a fat latina? u tell me'
	);
});

function withRandom<T>(value: number, run: () => T): T {
	const realRandom = Math.random;
	Math.random = () => value;
	try {
		return run();
	} finally {
		Math.random = realRandom;
	}
}

test('no canned line mid-conversation', () => {
	setSystemTime(new Date(50_000_000));
	const line = withRandom(0.005, () =>
		rareCasualLine('theres a 7 car pileup on your block', Date.now() - 60_000)
	);
	expect(line).toBeNull();
});

test('lazy lines only on a bare ping', () => {
	setSystemTime(new Date(60_000_000));
	expect(withRandom(0.005, () => rareCasualLine('jjb what do u think of the new champ', null))).toBeNull();
	setSystemTime(new Date(70_000_000));
	expect(LAZY_LINES).toContain(withRandom(0.005, () => rareCasualLine('yo', null)) ?? 'no line');
	setSystemTime();
});

test('games, loot rolls and recipes are never retried for repeats', () => {
	expect(shouldRetryForRepeats('hit', ['phrase:noted'])).toBe(false);
	expect(shouldRetryForRepeats('jjb give me random poe loot', ['opener:u got'])).toBe(false);
	expect(shouldRetryForRepeats('give me a recipe for congee', ['phrase:crime'])).toBe(false);
	expect(shouldRetryForRepeats('jjb u up', ['phrase:oh ur alive'])).toBe(true);
	expect(shouldRetryForRepeats('jjb u up', [])).toBe(false);
});

test('alias list never reaches the reply', async () => {
	const { stripSpeakerLabel } = await import('../src/modules/mention');
	expect(
		stripSpeakerLabel('hiii The Director / Wanners / @wanners. my review is void', 'The Director / Wanners / @wanners')
	).toBe('hiii The Director. my review is void');
	expect(stripSpeakerLabel('hi liv', 'liv')).toBe('hi liv');
});

test('a reply that saved, changed, searched or scheduled something is never retried', () => {
	expect(keepsResultOnRepeat({ reply: 'noted', memoryChanges: [{} as never] })).toBe(true);
	expect(keepsResultOnRepeat({ roleAction: {} as never })).toBe(true);
	expect(keepsResultOnRepeat({ customAction: {} as never })).toBe(true);
	expect(keepsResultOnRepeat({ customHelp: true })).toBe(true);
	expect(keepsResultOnRepeat({ recapHours: 1 })).toBe(true);
	expect(keepsResultOnRepeat({ reply: 'x', webSearched: true })).toBe(true);
	expect(keepsResultOnRepeat({ reply: 'noted', memoryChanges: [] })).toBe(false);
	expect(keepsResultOnRepeat({ reply: 'just chat' })).toBe(false);
});

test('a rude bare message can still get an annoyed line', () => {
	setSystemTime(new Date(900_000_000));
	expect(ANNOYED_LINES).toContain(withRandom(0.03, () => rareCasualLine('shut up jjb', null)) ?? 'no line');
	setSystemTime(new Date(990_000_000));
	expect(withRandom(0.03, () => rareCasualLine('ur not stupid jjb', null))).toBeNull();
	setSystemTime();
});

test('she greets people by display name or their saved nickname', () => {
	expect(addressPrompt('hannah', null)).toContain('Greet them by that display name');
	expect(addressPrompt('hannah', 'hannie')).toContain('asked to be called "hannie"');
});

test('she knows today\'s date in UK time', () => {
	expect(datePrompt(new Date('2026-11-04T12:00:00Z'))).toMatch(/^Today is Wednesday,? 4 November 2026 \(UK time\)/u);
	// 23:30 UTC in summer is already the next day in London
	expect(datePrompt(new Date('2026-07-01T23:30:00Z'))).toMatch(/Thursday,? 2 July 2026/u);
});
