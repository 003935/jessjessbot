/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { routeMessage } = await import('../src/modules/mention-router');
const { askDeepSeek, offeredCommands } = await import('../src/modules/mention');

const realFetch = globalThis.fetch;
let bodies: any[] = [];

function mockFetch(reply: (body: any) => unknown, status = 200) {
	globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body ?? '{}'));
		bodies.push(body);
		return new Response(JSON.stringify(reply(body)), { status });
	}) as typeof fetch;
}

function toolCall(name: string, args: object = {}) {
	return {
		choices: [
			{
				message: {
					content: '',
					tool_calls: [{ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }],
				},
			},
		],
	};
}

const toolNames = (body: any) => body.tools.map((tool: any) => tool.function.name);

afterEach(() => {
	globalThis.fetch = realFetch;
	bodies = [];
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
});

test('the router only offers chat plus the commands the message could be', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	mockFetch(() => toolCall('schedule_custom', { game: 'Deadlock', time: '14 November 2026 20:00' }));
	const route = await routeMessage('schedule Deadlock customs on 14 November 2026 20:00', [
		'ask_custom_details',
		'schedule_custom',
	]);
	expect(route).toEqual({
		kind: 'command',
		name: 'schedule_custom',
		args: { game: 'Deadlock', time: '14 November 2026 20:00' },
	});
	expect(toolNames(bodies[0])).toEqual(['chat', 'ask_custom_details', 'schedule_custom']);
	// It's a classifier, not jjb: no persona, no randomness.
	expect(bodies[0].temperature).toBe(0);
	expect(bodies[0].messages[0].content).not.toContain('beloved');
});

test('a waiting customs post lets the router confirm or cancel it', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	mockFetch(() => toolCall('confirm_pending'));
	expect(await routeMessage('yeah post it lol', [], { pendingPreview: '{"game":"Deadlock"}' })).toEqual({
		kind: 'confirm',
	});
	expect(toolNames(bodies[0])).toEqual(['chat', 'confirm_pending', 'cancel_pending']);
	mockFetch(() => toolCall('cancel_pending'));
	expect(await routeMessage('nah scrap that', [], { pendingPreview: '{"game":"Deadlock"}' })).toEqual({
		kind: 'cancel',
	});
});

test('the router treats tools it did not offer as chat, and a failed call as no route', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	mockFetch(() => toolCall('change_roles', { action: 'add', roles: 'x', target: 'me' }));
	expect(await routeMessage('jjb #1 inconvenience bot', ['summarize_channel'])).toEqual({ kind: 'chat' });
	mockFetch(() => toolCall('confirm_pending'));
	expect(await routeMessage('confirm', [])).toEqual({ kind: 'chat' });
	mockFetch(() => ({ error: 'down' }), 500);
	expect(await routeMessage('tldr past hour', ['summarize_channel'])).toBeNull();
});

test('only messages that could be commands get routed', () => {
	expect(offeredCommands('jjb #1 inconvenience bot', false)).toEqual([]);
	expect(offeredCommands('tldr past hour', false)).toEqual(['summarize_channel']);
	expect(offeredCommands('schedule Deadlock customs tonight at 8', false)).toEqual([
		'ask_custom_details',
		'schedule_custom',
	]);
	expect(offeredCommands('deadlock at 8', true)).toEqual(['ask_custom_details', 'schedule_custom']);
});

test('after routing, the persona gets no command tools and is told not to fake actions', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	mockFetch(() => toolCall('reply_chat', { reply: 'lol' }));
	const args: Parameters<typeof askDeepSeek> = ['tldr past hour', [], false];
	args[25] = true;
	await askDeepSeek(...args);
	expect(toolNames(bodies[0])).toContain('summarize_channel');
	args[25] = false;
	await askDeepSeek(...args);
	expect(toolNames(bodies[1])).not.toContain('summarize_channel');
	expect(bodies[1].messages[0].content).toContain('never say you confirmed, posted');
});
