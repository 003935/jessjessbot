/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { askDeepSeek } = await import('../src/modules/mention');

const realFetch = globalThis.fetch;
let calls = 0;

function respondWith(responses: Array<() => Response>) {
	calls = 0;
	globalThis.fetch = (async () =>
		responses[Math.min(calls++, responses.length - 1)]!()) as unknown as typeof fetch;
}

const ok = () =>
	new Response(
		JSON.stringify({
			choices: [
				{
					message: {
						content: '',
						tool_calls: [
							{
								id: 'c1',
								type: 'function',
								function: { name: 'reply_chat', arguments: '{"reply":"heyyy whats up"}' },
							},
						],
					},
				},
			],
		})
	);
const overloaded = () =>
	new Response(JSON.stringify({ error: { message: 'Server overloaded, please retry shortly.' } }), {
		status: 503,
	});

afterEach(() => {
	globalThis.fetch = realFetch;
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	delete process.env.TAVILY_API_KEY;
});

test('a single DeepSeek 503 is retried once and the reply still goes through', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	respondWith([overloaded, ok]);
	const result = await askDeepSeek('hi', [], false);
	expect(calls).toBe(2);
	expect(result.reply).toBe('heyyy whats up');
});

test('a DeepSeek error that persists reports its message and the request size', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	respondWith([overloaded]);
	const error = await askDeepSeek('hi', [], false).catch((caught: Error) => caught);
	expect(calls).toBe(2);
	expect(String(error)).toContain('DeepSeek returned HTTP 503');
	expect(String(error)).toContain('Server overloaded, please retry shortly.');
	expect(String(error)).toMatch(/request \d+ bytes, \d+ messages/);
});

test('other DeepSeek errors are not retried', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	respondWith([
		() => new Response('{"error":{"message":"Insufficient Balance"}}', { status: 402 }),
	]);
	const error = await askDeepSeek('hi', [], false).catch((caught: Error) => caught);
	expect(calls).toBe(1);
	expect(String(error)).toContain('Insufficient Balance');
});
