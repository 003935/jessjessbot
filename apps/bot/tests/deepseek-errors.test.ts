/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { askDeepSeek, DeepSeekUnavailableError, mentionFailureReply } = await import(
	'../src/modules/mention'
);

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

test('DeepSeek being down gets the in-character apology, other failures do not', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	respondWith([overloaded]);
	const down = await askDeepSeek('hi', [], false).catch((caught: Error) => caught);
	expect(down).toBeInstanceOf(DeepSeekUnavailableError);
	expect(mentionFailureReply(down)).toBe('sorry sniff no talk me, deepseek down not my fault (╥﹏╥)');

	respondWith([() => new Response('{"error":{"message":"Insufficient Balance"}}', { status: 402 })]);
	const broke = await askDeepSeek('hi', [], false).catch((caught: Error) => caught);
	expect(broke).not.toBeInstanceOf(DeepSeekUnavailableError);
	expect(mentionFailureReply(broke)).toBe('I could not finish that right now. Please try again.');
	expect(mentionFailureReply(new Error('database exploded'))).toBe(
		'I could not finish that right now. Please try again.'
	);
});

test('a DeepSeek timeout or network failure also counts as down', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	globalThis.fetch = (async () => {
		throw new DOMException('The operation timed out.', 'TimeoutError');
	}) as unknown as typeof fetch;
	const timedOut = await askDeepSeek('hi', [], false).catch((caught: Error) => caught);
	expect(timedOut).toBeInstanceOf(DeepSeekUnavailableError);
	globalThis.fetch = (async () => {
		throw new TypeError('fetch failed');
	}) as unknown as typeof fetch;
	const unreachable = await askDeepSeek('hi', [], false).catch((caught: Error) => caught);
	expect(unreachable).toBeInstanceOf(DeepSeekUnavailableError);
});
