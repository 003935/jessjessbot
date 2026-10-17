/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { formatSearchResults, sourceLink, webSearch, webSearchEnabled } = await import(
	'../src/modules/web-search'
);
const { askDeepSeek, isSearchWorthy } = await import('../src/modules/mention');

const realFetch = globalThis.fetch;
type Call = { url: string; body: any };
let calls: Call[] = [];

function mockFetch(handler: (url: string, body: any) => unknown) {
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		const body = JSON.parse(String(init?.body ?? '{}'));
		calls.push({ url, body });
		return new Response(JSON.stringify(handler(url, body)), { status: 200 });
	}) as typeof fetch;
}

function toolCall(name: string, args: object, id = 'call_1') {
	return {
		choices: [
			{
				message: {
					content: '',
					tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
				},
			},
		],
	};
}

const tavilyResponse = {
	answer: 'Patch 25.20 released on October 8.',
	results: [
		{ title: 'Patch notes', url: 'https://example.com/patch', content: 'Patch 25.20   notes\n here' },
		{ title: 'Other', url: 'https://example.com/other', content: 'other' },
	],
};

afterEach(() => {
	globalThis.fetch = realFetch;
	calls = [];
	delete process.env.TAVILY_API_KEY;
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
});

test('webSearch is disabled without an API key', async () => {
	delete process.env.TAVILY_API_KEY;
	expect(webSearchEnabled()).toBe(false);
	await expect(webSearch('x')).rejects.toThrow('TAVILY_API_KEY');
});

test('webSearch calls Tavily and normalises results', async () => {
	process.env.TAVILY_API_KEY = 'tvly-test';
	mockFetch(() => ({ ...tavilyResponse, results: [...tavilyResponse.results, { title: 'no url' }] }));
	const search = await webSearch('  latest league patch  ');
	expect(calls[0]!.url).toBe('https://api.tavily.com/search');
	expect(calls[0]!.body.query).toBe('latest league patch');
	expect(search.answer).toBe('Patch 25.20 released on October 8.');
	expect(search.results.map((result) => result.url)).toEqual([
		'https://example.com/patch',
		'https://example.com/other',
	]);
	const formatted = formatSearchResults('latest league patch', search);
	expect(formatted).toContain('Summary: Patch 25.20');
	expect(formatted).toContain('[1] Patch notes\nhttps://example.com/patch\nPatch 25.20 notes here');
	expect(formatSearchResults('q', { results: [] })).toBe('No web results found for "q".');
});

test('askDeepSeek does not offer web_search without a Tavily key', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	mockFetch(() => toolCall('reply_chat', { reply: 'hi there friend' }));
	await askDeepSeek('hello', [], false);
	const names = calls[0]!.body.tools.map((tool: any) => tool.function.name);
	expect(names).not.toContain('web_search');
});

test('askDeepSeek searches, then answers with a verified source link', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	process.env.TAVILY_API_KEY = 'tvly-test';
	let deepSeekCalls = 0;
	mockFetch((url) => {
		if (url.includes('tavily')) return tavilyResponse;
		deepSeekCalls++;
		return deepSeekCalls === 1
			? toolCall('web_search', { query: 'league patch 25.20 date' }, 'call_search')
			: toolCall('reply_chat', {
					reply: 'patch 25.20 dropped oct 8',
					source_url: 'https://evil.example/made-up',
					results_relevant: true,
				});
	});
	const result = await askDeepSeek('when did the new league patch come out', [], false);
	expect(calls.map((call) => call.url)).toEqual([
		expect.stringContaining('/chat/completions'),
		'https://api.tavily.com/search',
		expect.stringContaining('/chat/completions'),
	]);
	expect(calls[0]!.body.tools.map((tool: any) => tool.function.name)).toContain('web_search');
	expect(calls[1]!.body.query).toBe('league patch 25.20 date');
	const followUp = calls[2]!.body;
	expect(followUp.tools.map((tool: any) => tool.function.name)).toEqual(['reply_chat']);
	const toolMessage = followUp.messages.find((message: any) => message.role === 'tool');
	expect(toolMessage.tool_call_id).toBe('call_search');
	expect(toolMessage.content).toContain('https://example.com/patch');
	// A made-up URL falls back to the top real result.
	expect(result.reply).toBe('patch 25.20 dropped oct 8 [link](<https://example.com/patch>)');
});

test('askDeepSeek still replies when the search fails', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	process.env.TAVILY_API_KEY = 'tvly-test';
	let deepSeekCalls = 0;
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
		if (url.includes('tavily')) return new Response('nope', { status: 500 });
		deepSeekCalls++;
		return new Response(
			JSON.stringify(
				deepSeekCalls === 1
					? toolCall('web_search', { query: 'weather' })
					: toolCall('reply_chat', { reply: 'couldnt look that up rn' })
			)
		);
	}) as typeof fetch;
	const result = await askDeepSeek('weather in london today', [], false);
	expect(calls[2]!.body.messages.find((message: any) => message.role === 'tool').content).toContain(
		'search failed'
	);
	expect(result.reply).toBe('couldnt look that up rn');
});

test('askDeepSeek tells the model to search for current facts only when search is enabled', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	mockFetch(() => toolCall('reply_chat', { reply: 'hi there friend' }));
	await askDeepSeek('who won the last f1 race', [], false);
	expect(calls[0]!.body.messages[0].content).not.toContain('web_search');
	process.env.TAVILY_API_KEY = 'tvly-test';
	await askDeepSeek('who won the last f1 race', [], false);
	expect(calls[1]!.body.messages[0].content).toContain('default to answering from the chat');
});

test('isSearchWorthy only lets fact-seeking messages search', () => {
	for (const prompt of [
		'when did the new league patch come out',
		'weather in london today',
		'who won the last f1 race',
		'jjb can you look up fat katz',
		'how much is a switch 2?',
	])
		expect(isSearchWorthy(prompt)).toBe(true);
	for (const prompt of [
		'wtf adoptable cats',
		'jjb putting ur cats up there or what',
		'Good morning jjb',
		'what do you think of my cat',
		'how many cats do we have',
		'lol the patch sucks',
	])
		expect(isSearchWorthy(prompt)).toBe(false);
});

test('askDeepSeek does not offer web_search for banter', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	process.env.TAVILY_API_KEY = 'tvly-test';
	mockFetch(() => toolCall('reply_chat', { reply: 'theyre not mine kirsty' }));
	await askDeepSeek('jjb putting ur cats up there or what', [], false);
	expect(calls[0]!.body.tools.map((tool: any) => tool.function.name)).not.toContain('web_search');
	expect(calls[0]!.body.messages[0].content).not.toContain('web_search');
});

test('askDeepSeek drops the link when the results are off topic', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	process.env.TAVILY_API_KEY = 'tvly-test';
	let deepSeekCalls = 0;
	mockFetch((url) => {
		if (url.includes('tavily')) return tavilyResponse;
		deepSeekCalls++;
		return deepSeekCalls === 1
			? toolCall('web_search', { query: 'fatkatz' }, 'call_search')
			: toolCall('reply_chat', {
					reply: 'no clue who that is',
					source_url: 'https://example.com/patch',
					results_relevant: false,
				});
	});
	const result = await askDeepSeek('who is fatkatz?', [], false);
	expect(calls[2]!.body.tools[0].function.parameters.required).toContain('results_relevant');
	expect(result.reply).toBe('no clue who that is');
});

test('sourceLink makes a Discord link with no preview, even for URLs with brackets', () => {
	expect(sourceLink('https://example.com/patch')).toBe('[link](<https://example.com/patch>)');
	expect(sourceLink('https://en.wikipedia.org/wiki/Cars_(film)')).toBe(
		'[link](<https://en.wikipedia.org/wiki/Cars_%28film%29>)'
	);
});
