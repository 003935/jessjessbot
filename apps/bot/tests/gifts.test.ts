/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';
import { ALREADY_GIFTED } from '../src/modules/gift-table';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

const saved = new Map<string, string>();
// Only the gift-day preference exists; any other table call (like a relationship score) would throw.
mock.module('../src/db', () => ({
	db: {
		botMemberPreference: {
			getValue: async (guildId: string, userId: string, kind: string) => saved.get(`${guildId}:${userId}:${kind}`) ?? null,
			setValue: async (guildId: string, userId: string, kind: string, value: string) => {
				saved.set(`${guildId}:${userId}:${kind}`, value);
			},
		},
	},
}));

const { handleGift } = await import('../src/modules/mention-gifts');

test('one gift a day, and a gift changes nothing but the gift day', async () => {
	const first = await handleGift('g', 'u', '*gives u a mango*');
	expect(first).toContain('mango');
	expect(await handleGift('g', 'u', '*gives u boba*')).toBe(ALREADY_GIFTED);
	expect([...saved.keys()]).toEqual(['g:u:gift_day']);
});

test('normal chat is not handled as a gift', async () => {
	expect(await handleGift('g', 'u2', 'hi jjb')).toBeNull();
});
