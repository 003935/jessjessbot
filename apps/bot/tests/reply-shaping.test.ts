/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { dropFollowUpQuestion } = await import('../src/modules/mention');

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
