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
	// The source link comes back separately so voice never reads it out.
	expect(result.reply).toBe('patch 25.20 dropped oct 8');
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

const replyChatParams = (call: Call) =>
	call.body.tools.find((tool: any) => tool.function.name === 'reply_chat').function.parameters.properties;
const mediaArgs = (mediaKind: 'pet' | 'food') =>
	['cute cat', [], false, ...Array(16).fill(undefined), mediaKind] as unknown as Parameters<typeof askDeepSeek>;

test('askDeepSeek returns memory changes from reply_chat', async () => {
	mockFetch(() =>
		toolCall('reply_chat', {
			reply: 'cheesy ghosty mini, locked in',
			remember: [{ kind: 'pet', name: 'cheesy', value: 'cat' }],
		})
	);
	const result = await askDeepSeek('remember my cat cheesy', [], false);
	expect(result.memoryChanges).toEqual([{ op: 'remember', about: null, kind: 'pet', name: 'cheesy', value: 'cat' }]);
	expect(result.memoryDropped).toBe(0);
	expect(Object.keys(replyChatParams(calls[0]!))).toEqual(expect.arrayContaining(['remember', 'forget']));
});

test('plain replies carry no memory changes', async () => {
	mockFetch(() => toolCall('reply_chat', { reply: 'hi there friend' }));
	const result = await askDeepSeek('hello', [], false);
	expect(result.memoryChanges).toBeUndefined();
});

test('media reactions get no memory fields', async () => {
	mockFetch(() => toolCall('reply_chat', { reply: 'what a chonk' }));
	await askDeepSeek(...mediaArgs('pet'));
	expect(replyChatParams(calls[0]!).remember).toBeUndefined();
});

test('prompt tells her to only claim saves she sent', async () => {
	mockFetch(() => toolCall('reply_chat', { reply: 'hi there friend' }));
	await askDeepSeek('hello', [], false);
	expect(calls[0]!.body.messages[0].content).toContain('Only say you saved something if you included it');
});

const withLookup = (prompt: string, lookup: unknown, mediaKind?: 'pet') =>
	[prompt, [], false, ...Array(16).fill(undefined), mediaKind, lookup] as unknown as Parameters<typeof askDeepSeek>;
const toolNames = (call: Call) => call.body.tools.map((tool: any) => tool.function.name);

test('recall_member looks up the member and answers from it', async () => {
	const asked: string[] = [];
	const lookup = async (name: string) => {
		asked.push(name);
		return {
			status: 'found',
			member: {
				id: 'h',
				displayName: 'boss cuck',
				aliases: ['hannie'],
				mention: false,
				botNickname: null,
				details: {
					likes: [],
					dislikes: [],
					pets: ['cheesy is my cat', 'ghosty is my cat', 'mini is my cat'],
					birthday: null,
					favourites: [],
					notes: [],
				},
			},
		};
	};
	let n = 0;
	mockFetch(() =>
		++n === 1
			? toolCall('recall_member', { name: 'hannies' }, 'call_recall')
			: toolCall('reply_chat', { reply: 'cheesy, ghosty and mini' })
	);
	const result = await askDeepSeek(...withLookup('jjb list out hannies cats', lookup));
	expect(asked).toEqual(['hannies']);
	expect(toolNames(calls[0]!)).toContain('recall_member');
	const toolMessage = calls[1]!.body.messages.find((message: any) => message.role === 'tool');
	expect(toolMessage.tool_call_id).toBe('call_recall');
	expect(toolMessage.content).toContain('cheesy is my cat');
	expect(toolNames(calls[1]!)).toEqual(['reply_chat']);
	expect(result.reply).toBe('cheesy, ghosty and mini');
});

test('recall_member with no match tells her not to invent', async () => {
	let n = 0;
	mockFetch(() =>
		++n === 1
			? toolCall('recall_member', { name: 'zorbo' }, 'call_recall')
			: toolCall('reply_chat', { reply: 'who even is that' })
	);
	await askDeepSeek(...withLookup('jjb list out zorbos cats', async () => ({ status: 'none' })));
	const toolMessage = calls[1]!.body.messages.find((message: any) => message.role === 'tool');
	expect(toolMessage.content).toContain('Do not invent details');
});

test('recall_member not offered without a lookup or for media', async () => {
	mockFetch(() => toolCall('reply_chat', { reply: 'hi there friend' }));
	await askDeepSeek('hello', [], false);
	await askDeepSeek(...withLookup('cute cat', async () => ({ status: 'none' }), 'pet'));
	expect(toolNames(calls[0]!)).not.toContain('recall_member');
	expect(toolNames(calls[1]!)).not.toContain('recall_member');
});

test('null memory fields leave a plain reply alone', async () => {
	mockFetch(() => toolCall('reply_chat', { reply: 'hii', remember: null, forget: null }));
	const result = await askDeepSeek('hello', [], false);
	expect(result.memoryChanges).toBeUndefined();
});

test('server info goes into her system prompt', async () => {
	mockFetch(() => toolCall('reply_chat', { reply: 'fat club obviously' }));
	await askDeepSeek(
		...(['whats this server called', [], false, ...Array(17).fill(undefined), null, 'You are in the Discord server "fat club"'] as unknown as Parameters<
			typeof askDeepSeek
		>)
	);
	expect(calls[0]!.body.messages[0].content).toContain('You are in the Discord server "fat club"');
});

test('a server can turn the meme bit off', async () => {
	mockFetch(() => toolCall('reply_chat', { reply: 'gg' }));
	const { DEFAULT_SERVER_SETTINGS } = await import('../src/personality/server-settings');
	const personality = { extra: null, preferences: null, opinions: [], server: { ...DEFAULT_SERVER_SETTINGS, memeEnabled: false } };
	await askDeepSeek(
		...(['we won', [], false, ...Array(13).fill(undefined), personality] as unknown as Parameters<typeof askDeepSeek>)
	);
	expect(calls[0]!.body.messages[0].content).not.toContain('gg fkin ez');
	await askDeepSeek('we won', [], false);
	expect(calls[1]!.body.messages[0].content).toContain('gg fkin ez');
});
