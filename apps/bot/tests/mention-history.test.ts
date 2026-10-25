/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { collapseOwnReplies } = await import('../src/modules/mention-history');
const { historyForPrompt } = await import('../src/modules/mention');

const turn = (i: number) => ({ role: i % 2 ? ('assistant' as const) : ('user' as const), content: `t${i}` });

test('keeps the last six of her replies verbatim and collapses older ones', () => {
	const turns = Array.from({ length: 20 }, (_, i) => turn(i));
	const out = collapseOwnReplies(turns);
	expect(out).toHaveLength(20);
	expect(out.filter((t) => t.content === '[jjb replied]')).toHaveLength(4);
	expect(out.at(-1)!.content).toBe('t19');
	expect(out.filter((t) => t.role === 'user').map((t) => t.content)).toEqual(
		turns.filter((t) => t.role === 'user').map((t) => t.content)
	);
});

test('a run of only her replies still keeps the latest one', () => {
	const turns = Array.from({ length: 9 }, (_, i) => ({ role: 'assistant' as const, content: `a${i}` }));
	const out = collapseOwnReplies(turns);
	expect(out.at(-1)!.content).toBe('a8');
	expect(out.filter((t) => t.content === '[jjb replied]')).toHaveLength(3);
});

test('historyForPrompt output never has more than six full replies from her', () => {
	const now = Date.now();
	const turns = Array.from({ length: 24 }, (_, i) => ({ ...turn(i), at: now - 1000 }));
	const full = historyForPrompt('jjb', turns, now).filter(
		(t) => t.role === 'assistant' && t.content !== '[jjb replied]'
	);
	expect(full).toHaveLength(6);
});
