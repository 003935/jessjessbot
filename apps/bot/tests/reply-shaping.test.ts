/// <reference types="bun" />
import { expect, mock, setSystemTime, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { dropFollowUpQuestion, rareCasualLine, shouldRetryForRepeats } = await import('../src/modules/mention');
const { DEFAULT_SERVER_SETTINGS } = await import('../src/personality/server-settings');

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
		rareCasualLine('theres a 7 car pileup on your block', DEFAULT_SERVER_SETTINGS, Date.now() - 60_000)
	);
	expect(line).toBeNull();
});

test('lazy lines only on a bare ping', () => {
	setSystemTime(new Date(60_000_000));
	expect(withRandom(0.005, () => rareCasualLine('jjb what do u think of the new champ', DEFAULT_SERVER_SETTINGS, null))).toBeNull();
	setSystemTime(new Date(70_000_000));
	expect(withRandom(0.005, () => rareCasualLine('yo', { ...DEFAULT_SERVER_SETTINGS, lazyLines: ['on break'] }, null))).toBe('on break');
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
