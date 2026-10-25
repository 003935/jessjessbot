/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

const nicknames: string[] = [];
mock.module('../src/db', () => ({
	db: {
		botMemberPreference: {
			list: async () => ({
				likes: [],
				dislikes: [],
				pets: ['cheesy is my cat'],
				birthday: null,
				favourites: [],
				notes: [],
			}),
			setNickname: async (_guildId: string, _userId: string, nickname: string) => {
				nicknames.push(nickname);
			},
		},
	},
}));

const { handleMemberMemory } = await import('../src/modules/mention-memory');

test('what do u remember about me still answers from saved details', async () => {
	expect(await handleMemberMemory('g', 'u', 'what do u remember about me')).toContain('cheesy is my cat');
});

test('free-form remember requests are left to the model', async () => {
	expect(await handleMemberMemory('g', 'u', 'remember my cats are a, b and c')).toBeNull();
	expect(await handleMemberMemory('g', 'u', 'remember cheesy is my cat')).toBeNull();
	expect(await handleMemberMemory('g', 'u', 'forget my pets')).toBeNull();
});

test('call me still sets the nickname', async () => {
	expect(await handleMemberMemory('g', 'u', 'call me chocbob')).toContain('chocbob');
	expect(nicknames).toEqual(['chocbob']);
});

test('a trailing please is not part of the nickname', async () => {
	nicknames.length = 0;
	await handleMemberMemory('g', 'u', 'call me the director please');
	await handleMemberMemory('g', 'u', 'call me big pls');
	await handleMemberMemory('g', 'u', 'call me please daddy');
	expect(nicknames).toEqual(['the director', 'big', 'please daddy']);
});
