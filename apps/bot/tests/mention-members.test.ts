/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { findMembersByName, formatMemberContext, membersNamedIn, nameVariants, queryNamesMember, replaceUserMentions } =
	await import('../src/modules/mention-members');
const { askDeepSeek } = await import('../src/modules/mention');

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
	delete process.env.TAVILY_API_KEY;
});

const candidates = [
	{ id: '1', names: ['mihaya', 'sushicurry'] },
	{ id: '2', names: ['dust [AЮN2],', 'dustbunny'] },
	{ id: '3', names: ['mond [fat],'] },
	{ id: '4', names: ['al'] },
];

test('decorated server nicknames also match their plain name', () => {
	expect(nameVariants('dust [AЮN2],')).toEqual(['dust [AЮN2],', 'dust']);
	expect(nameVariants('al')).toEqual([]);
});

test('finds members named as whole words, in message order', () => {
	expect(membersNamedIn('jjb who is sushicurry', candidates)).toEqual(['1']);
	expect(membersNamedIn('mond says mihaya is racist', candidates)).toEqual(['3', '1']);
	expect(membersNamedIn('ask @dust about it', candidates)).toEqual(['2']);
	expect(membersNamedIn('the sushicurryrecipe and stardust', candidates)).toEqual([]);
	expect(membersNamedIn('<@1> hi al', candidates)).toEqual([]);
});

test('possessive names match with or without an apostrophe', () => {
	expect(membersNamedIn('jjb list out mihayas cats', candidates)).toEqual(['1']);
	expect(membersNamedIn("list mihaya's cats", candidates)).toEqual(['1']);
	expect(membersNamedIn('list mihaya’s cats', candidates)).toEqual(['1']);
});

test('findMembersByName resolves loose names', () => {
	const people = [
		{ id: 'h', names: ['boss cuck', 'hannie'] },
		{ id: 'f', names: ['fat ark [fat],'] },
		{ id: 'd1', names: ['dustbunny'] },
		{ id: 'd2', names: ['dustpan'] },
	];
	expect(findMembersByName('hannies', people)).toEqual(['h']);
	expect(findMembersByName("hannie's", people)).toEqual(['h']);
	expect(findMembersByName('@Hannie', people)).toEqual(['h']);
	expect(findMembersByName('fat ark', people)).toEqual(['f']);
	expect(findMembersByName('boss', people)).toEqual(['h']);
	expect(findMembersByName('dust', people)).toEqual(['d1', 'd2']);
	expect(findMembersByName('zz', people)).toEqual([]);
	expect(findMembersByName('nobody', people)).toEqual([]);
});

test('rewrites raw user mentions as names', () => {
	expect(replaceUserMentions('this is <@1> remember that', (id) => (id === '1' ? 'mihaya' : undefined))).toBe(
		'this is @mihaya remember that'
	);
	expect(replaceUserMentions('<@!9> hi', () => undefined)).toBe('<@!9> hi');
});

const mihaya = {
	id: '1',
	displayName: 'mihaya',
	aliases: ['sushicurry'],
	mention: true,
	botNickname: null,
	details: { likes: ['curry'], dislikes: [], pets: [], birthday: null, favourites: [], notes: [] },
};

test('member context names the person, mention id, and saved details', () => {
	const context = formatMemberContext([mihaya])!;
	expect(context).toContain('never web search them');
	expect(context).toContain('they/them');
	expect(context).toContain('"mihaya" (@mentioned as <@1>; also goes by "sushicurry"; saved details');
	expect(formatMemberContext([])).toBeNull();
	expect(queryNamesMember('sushicurry discord', [mihaya])?.id).toBe('1');
	expect(queryNamesMember('sushi curry recipe', [mihaya])).toBeNull();
});

test('askDeepSeek skips web searches about server members', async () => {
	process.env.DEEPSEEK_API_KEY = 'test-deepseek';
	process.env.TAVILY_API_KEY = 'tvly-test';
	const urls: string[] = [];
	const bodies: any[] = [];
	let deepSeekCalls = 0;
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		urls.push(String(input));
		bodies.push(JSON.parse(String(init?.body ?? '{}')));
		deepSeekCalls++;
		const [name, args] =
			deepSeekCalls === 1 ? ['web_search', { query: 'who is sushicurry' }] : ['reply_chat', { reply: 'mihaya. u know mihaya' }];
		return new Response(
			JSON.stringify({
				choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }],
			})
		);
	}) as typeof fetch;
	const result = await askDeepSeek(
		'who is sushicurry',
		[],
		false,
		null,
		0,
		null,
		false,
		false,
		'dust',
		null,
		'dust',
		'dust',
		[],
		[mihaya]
	);
	expect(urls.some((url) => url.includes('tavily'))).toBe(false);
	expect(bodies[0].messages.some((message: any) => String(message.content).includes('"mihaya"'))).toBe(true);
	expect(bodies[1].messages.find((message: any) => message.role === 'tool').content).toContain('member of this Discord server');
	expect(result.reply).toBe('mihaya. u know mihaya');
});
