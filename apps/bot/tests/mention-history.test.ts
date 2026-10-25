/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { collapseOwnReplies } = await import('../src/modules/mention-history');
const { historyForPrompt } = await import('../src/modules/mention');

const turn = (i: number) => ({ role: i % 2 ? ('assistant' as const) : ('user' as const), content: `t${i}` });

test('keeps the last six of her replies verbatim and drops older ones', () => {
	const turns = Array.from({ length: 20 }, (_, i) => turn(i));
	const out = collapseOwnReplies(turns);
	expect(out).toHaveLength(16);
	expect(out.filter((t) => t.role === 'assistant').map((t) => t.content)).toEqual(['t9', 't11', 't13', 't15', 't17', 't19']);
	expect(JSON.stringify(out)).not.toContain('[jjb replied]');
	expect(out.at(-1)!.content).toBe('t19');
	expect(out.filter((t) => t.role === 'user').map((t) => t.content)).toEqual(
		turns.filter((t) => t.role === 'user').map((t) => t.content)
	);
});

test('a run of only her replies still keeps the latest one', () => {
	const turns = Array.from({ length: 9 }, (_, i) => ({ role: 'assistant' as const, content: `a${i}` }));
	const out = collapseOwnReplies(turns);
	expect(out.at(-1)!.content).toBe('a8');
	expect(out).toHaveLength(6);
});

test('historyForPrompt output never has more than six full replies from her', () => {
	const now = Date.now();
	const turns = Array.from({ length: 24 }, (_, i) => ({ ...turn(i), at: now - 1000 }));
	const own = historyForPrompt('jjb', turns, now).filter((t) => t.role === 'assistant');
	expect(own).toHaveLength(6);
});
