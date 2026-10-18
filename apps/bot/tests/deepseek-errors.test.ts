/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const {
	askDeepSeek,
	DEEPSEEK_DOWN_SCENARIOS,
	DeepSeekUnavailableError,
	MENTION_FAILED_REPLY,
	mentionFailureReply,
	resetDeepSeekDownStreak,
} = await import(
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
	const firstLines = Object.values(DEEPSEEK_DOWN_SCENARIOS).map((stages) => stages.flat()[0]);
	expect(firstLines).toContain(mentionFailureReply(down, 'channel-a'));

	respondWith([() => new Response('{"error":{"message":"Insufficient Balance"}}', { status: 402 })]);
	const broke = await askDeepSeek('hi', [], false).catch((caught: Error) => caught);
	expect(broke).not.toBeInstanceOf(DeepSeekUnavailableError);
	expect(mentionFailureReply(broke, 'channel-a')).toBe(MENTION_FAILED_REPLY);
	expect(mentionFailureReply(new Error('database exploded'), 'channel-a')).toBe(MENTION_FAILED_REPLY);
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

test('an outage picks one storyline and plays it in order per channel', () => {
	const breakdown = DEEPSEEK_DOWN_SCENARIOS.breakdown.flat();
	const outOfOffice = DEEPSEEK_DOWN_SCENARIOS.outOfOffice.flat();
	const down = new DeepSeekUnavailableError('down');
	const now = 1_000_000;
	const pickBreakdown = () => 0;
	const pickOutOfOffice = () => 0.99;
	for (const channel of ['channel-b', 'channel-c', 'channel-d']) resetDeepSeekDownStreak(channel);

	// The storyline is chosen on the first failure and kept for the rest of the outage.
	const said = breakdown.map((_, index) =>
		mentionFailureReply(down, 'channel-b', now + index, index ? pickOutOfOffice : pickBreakdown)
	);
	expect(said).toEqual(breakdown);
	expect(mentionFailureReply(down, 'channel-b', now + 100, pickOutOfOffice)).toBe(breakdown.at(-1)!);

	// Another channel has its own outage and storyline.
	const office = outOfOffice.map((_, index) =>
		mentionFailureReply(down, 'channel-c', now + index, index ? pickBreakdown : pickOutOfOffice)
	);
	expect(office).toEqual(outOfOffice);
	expect(mentionFailureReply(down, 'channel-c', now + 100, pickBreakdown)).toBe(outOfOffice.at(-1)!);

	// A normal reply starts the next outage over, with a fresh storyline.
	resetDeepSeekDownStreak('channel-b');
	expect(mentionFailureReply(down, 'channel-b', now + 200, pickOutOfOffice)).toBe(outOfOffice[0]!);

	// So does 30 minutes without a failure.
	expect(mentionFailureReply(down, 'channel-d', now, pickBreakdown)).toBe(breakdown[0]!);
	expect(mentionFailureReply(down, 'channel-d', now + 1, pickBreakdown)).toBe(breakdown[1]!);
	expect(mentionFailureReply(down, 'channel-d', now + 1 + 30 * 60 * 1000, pickBreakdown)).toBe(breakdown[0]!);
});

test("failure replies use the server's own scenarios", () => {
	expect(mentionFailureReply(new DeepSeekUnavailableError('x'), 'custom-c9', 0, () => 0, { only: [['custom down line']] })).toBe(
		'custom down line'
	);
});
