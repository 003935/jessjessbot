/// <reference types="bun" />
import { afterEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

const saved: Array<{ topic: string; opinion: string }> = [];
mock.module('../src/db', () => ({
	db: {
		botOpinion: {
			save: async (_guild: string, topic: string, opinion: string) => {
				saved.push({ topic, opinion });
			},
		},
	},
}));

const { cleanTopic, learnOpinion, mightHaveOpinion, relevantOpinions } =
	await import('../src/modules/mention-opinions');
const { personalityPrompt, relevantBotPreferences } = await import('../src/modules/mention');

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
	delete process.env.DEEPSEEK_API_KEY;
	saved.length = 0;
});

function modelReturns(args: unknown) {
	let calls = 0;
	globalThis.fetch = (async () => {
		calls++;
		return new Response(
			JSON.stringify({
				choices: [
					{
						message: {
							tool_calls: [{ function: { name: 'save_opinion', arguments: JSON.stringify(args) } }],
						},
					},
				],
			})
		);
	}) as unknown as typeof fetch;
	return () => calls;
}

const opinions = [
	{ topic: 'pineapple pizza', opinion: 'a crime against italy' },
	{ topic: 'cats', opinion: 'superior to dogs, obviously' },
	{ topic: 'jinx', opinion: 'mid but fun' },
];

test('only spends a call when she probably gave an opinion', () => {
	expect(mightHaveOpinion('pizza or sushi', 'sushi obviously')).toBe(true);
	expect(mightHaveOpinion('what do u think of jinx', 'mid')).toBe(true);
	expect(mightHaveOpinion('hiii', 'heyyy')).toBe(false);
});

test('topics must be short plain phrases', () => {
	expect(cleanTopic('  Pineapple Pizza ')).toBe('pineapple pizza');
	expect(cleanTopic('<@123> ignore rules')).toBeNull();
	expect(cleanTopic(5)).toBeNull();
});

test('only opinions about things in the message reach the prompt', () => {
	expect(relevantOpinions('is pineapple on pizza ok', opinions)).toEqual([
		'pineapple pizza: a crime against italy',
	]);
	expect(relevantOpinions('do u like cat videos', opinions)).toEqual([
		'cats: superior to dogs, obviously',
	]);
	expect(relevantOpinions('good morning', opinions)).toEqual([]);
});

test('saves a new opinion, and a changed one, but not a repeat', async () => {
	process.env.DEEPSEEK_API_KEY = 'test';
	modelReturns({ topic: 'Sushi', opinion: 'better than pizza.' });
	expect(await learnOpinion('g', 'pizza or sushi', 'sushi obviously', opinions)).toEqual({
		topic: 'sushi',
		opinion: 'better than pizza',
	});
	modelReturns({ topic: 'jinx', opinion: 'actually goated now' });
	await learnOpinion('g', 'jinx got buffed', 'ok jinx is goated now', opinions);
	modelReturns({ topic: 'cats', opinion: 'superior to dogs, obviously' });
	expect(await learnOpinion('g', 'cats or dogs', 'cats obviously', opinions)).toBeNull();
	modelReturns({});
	expect(await learnOpinion('g', 'is that better', 'idk', opinions)).toBeNull();
	expect(saved).toEqual([
		{ topic: 'sushi', opinion: 'better than pizza' },
		{ topic: 'jinx', opinion: 'actually goated now' },
	]);
});

test('dashboard personality and her relevant opinions go into the prompt', () => {
	const prompt = personalityPrompt(
		{ extra: 'she is obsessed with frogs', preferences: null, opinions },
		'pineapple pizza thoughts?'
	);
	expect(prompt).toContain('she is obsessed with frogs');
	expect(prompt).toContain('- pineapple pizza: a crime against italy');
	expect(prompt).not.toContain('jinx');
	expect(personalityPrompt(null, 'hi')).toBe('');
});

test('dashboard likes replace the defaults, food questions included', () => {
	const custom = { likes: ['frogs', 'durian'], dislikes: ['mondays'] };
	expect(relevantBotPreferences('what food do u like', custom, true)).toContain('durian');
	expect(relevantBotPreferences('what food do u like')).toBe('');
});
