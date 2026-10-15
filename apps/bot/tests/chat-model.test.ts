/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { chatModel, chatRequestFields } = await import('../src/modules/chat-model');
const { describeEmbed, linkPreviewContext } = await import('../src/modules/mention-context');
const { askDeepSeek } = await import('../src/modules/mention');

const CHAT_ENV = [
	'CHAT_API_URL',
	'CHAT_API_KEY',
	'CHAT_MODEL',
	'CHAT_DEEP_MODEL',
	'CHAT_VISION_MODEL',
	'CHAT_REASONING_EFFORT',
	'CHAT_DEEP_REASONING_EFFORT',
	'DEEPSEEK_API_KEY',
	'DEEPSEEK_MODEL',
];
const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
	for (const key of CHAT_ENV) delete process.env[key];
});

test('keeps the old DeepSeek setup by default, with thinking only for deep tasks', () => {
	expect(chatRequestFields('quick', { temperature: 1.2, maxTokens: 250 })).toEqual({
		model: 'deepseek-flash',
		thinking: { type: 'disabled' },
		temperature: 1.2,
		max_tokens: 250,
	});
	expect(chatRequestFields('deep', { temperature: 1.2, maxTokens: 500 })).toEqual({
		model: 'deepseek-flash',
		thinking: { type: 'enabled' },
		max_tokens: 4500,
	});
});

test('uses reasoning_effort and per-task models on other OpenAI-compatible APIs', () => {
	process.env.CHAT_API_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
	process.env.CHAT_MODEL = 'fast-model';
	process.env.CHAT_DEEP_MODEL = 'smart-model';
	process.env.CHAT_VISION_MODEL = 'eyes-model';
	process.env.CHAT_DEEP_REASONING_EFFORT = 'high';
	expect(chatRequestFields('quick', { temperature: 1.2, maxTokens: 250 })).toEqual({
		model: 'fast-model',
		temperature: 1.2,
		max_tokens: 250,
	});
	expect(chatRequestFields('deep', { maxTokens: 300 })).toEqual({
		model: 'smart-model',
		reasoning_effort: 'high',
		max_tokens: 4300,
	});
	expect(chatModel('quick', true)).toBe('eyes-model');
	expect(chatRequestFields('deep', { maxTokens: 300, reasoning: false })).toEqual({
		model: 'smart-model',
		max_tokens: 300,
	});
});

test('turns link previews into short context lines', () => {
	expect(
		describeEmbed({
			title: 'Cat learns to open fridge',
			description: 'He  will not\nstop',
			url: 'https://youtu.be/x',
			provider: { name: 'YouTube', url: null },
			author: { name: 'catchannel' },
		} as never)
	).toBe('[YouTube] by catchannel: "Cat learns to open fridge" | He will not stop');
	expect(describeEmbed({ title: null, description: null } as never)).toBeNull();
	const current = { embeds: [{ title: 'new patch', description: null }] } as never;
	expect(linkPreviewContext(current, [])).toContain('- in the latest message: "new patch"');
	expect(linkPreviewContext({ embeds: [] } as never, [])).toBeNull();
});

test('a link gets reasoning, and falls back without it if the model rejects that', async () => {
	process.env.DEEPSEEK_API_KEY = 'test';
	const bodies: Array<Record<string, unknown>> = [];
	globalThis.fetch = (async (_url: string, init: RequestInit) => {
		bodies.push(JSON.parse(String(init.body)));
		if (bodies.length === 1)
			return new Response('thinking not supported with tool_choice', { status: 400 });
		return new Response(
			JSON.stringify({
				choices: [
					{
						message: {
							tool_calls: [
								{
									id: 'c1',
									function: {
										name: 'reply_chat',
										arguments: '{"reply":"the fridge cat is my hero"}',
									},
								},
							],
						},
					},
				],
			})
		);
	}) as unknown as typeof fetch;
	const result = await askDeepSeek(
		'look at this',
		[],
		false,
		null,
		0,
		null,
		false,
		false,
		'mond',
		null,
		'mond',
		'mond',
		[],
		[],
		'Link previews...:\n- in the latest message: "Cat learns to open fridge"'
	);
	expect(result.reply).toBe('the fridge cat is my hero');
	expect(bodies[0]!.thinking).toEqual({ type: 'enabled' });
	expect(bodies[1]!.thinking).toEqual({ type: 'disabled' });
	expect(JSON.stringify(bodies[0]!.messages)).toContain('Do not summarise or restate the preview');
});

const { channelBackground, formatConversationAround } =
	await import('../src/modules/mention-context');

function fakeMessage(
	id: string,
	minutesAgo: number,
	name: string,
	content: string,
	authorId = name
) {
	return {
		id,
		content,
		createdTimestamp: Date.now() - minutesAgo * 60_000,
		author: { id: authorId, bot: authorId === 'bot', username: name, globalName: name },
		member: { displayName: name },
		mentions: { users: new Map(), repliedUser: null },
		attachments: new Map(),
		embeds: [],
	};
}

test('marks the replied-to message inside the conversation around it', () => {
	const around = formatConversationAround(
		[
			fakeMessage('2', 300, 'jjb', 'pineapple pizza is a crime', 'bot'),
			fakeMessage('1', 301, 'mond', 'jjb is pineapple on pizza ok'),
			fakeMessage('3', 299, 'hannah', 'she is right'),
		] as never,
		'2',
		'bot'
	)!;
	expect(around.split('\n').slice(1)).toEqual([
		'mond: jjb is pineapple on pizza ok',
		'>> jessjessbot (you): pineapple pizza is a crime',
		'hannah: she is right',
	]);
});

test('fetches the conversation around a replied-to message that is out of the recent window', async () => {
	const calls: unknown[] = [];
	const old = [
		fakeMessage('old1', 600, 'mond', 'who is going to the concert'),
		fakeMessage('old2', 599, 'dust', 'me!! saturday'),
	];
	const recent = [fakeMessage('r1', 2, 'hannah', 'anyway dinner?')];
	const message = {
		id: 'now',
		reference: { messageId: 'old2' },
		client: { user: { id: 'bot' } },
		channel: {
			messages: {
				fetch: async (options: { around?: string }) => {
					calls.push(options);
					return new Map((options.around ? old : recent).map((m) => [m.id, m]));
				},
			},
		},
	};
	const context = (await channelBackground(message as never))!;
	expect(calls).toEqual([
		{ limit: 25, before: 'now' },
		{ around: 'old2', limit: 21 },
	]);
	expect(context).toContain('>> dust: me!! saturday');
	expect(context).toContain('mond: who is going to the concert');
	expect(context).toContain('hannah: anyway dinner?');

	// A reply to something still in the recent messages needs no extra fetch.
	calls.length = 0;
	await channelBackground({ ...message, reference: { messageId: 'r1' } } as never);
	expect(calls).toEqual([{ limit: 25, before: 'now' }]);
});
