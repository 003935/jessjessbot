/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { emojiMatchesWord, withServerEmoji } from '../src/modules/server-emojis';

function guildWith(names: string[]) {
	const emojis = new Map(
		names.map((name, i) => [
			String(i),
			{ name, available: true, roles: { cache: new Map() }, toString: () => `<:${name}:${i}>` },
		])
	);
	return {
		id: `g-${names.join('-')}`,
		emojis: { fetch: async () => emojis },
		members: { fetchMe: async () => ({ roles: { cache: new Map() } }) },
	} as any;
}

test('whole-word emoji matching only', () => {
	expect(emojiMatchesWord('bcaBugcatSomberCry', 'cry')).toBe(true);
	expect(emojiMatchesWord('mango_happy', 'mango')).toBe(true);
	expect(emojiMatchesWord('cat', 'scattered')).toBe(false);
	expect(emojiMatchesWord('piltover', 'pilt')).toBe(false);
	expect(emojiMatchesWord('emoji_114', 'cult')).toBe(false);
});

test('nine in ten replies get no emoji', async () => {
	expect(await withServerEmoji(guildWith(['lolcat']), 'lol ok', 'lol', () => 0.5)).toBe('lol ok');
});

test('a matching emoji is added on the lucky roll', async () => {
	expect(await withServerEmoji(guildWith(['sadcry', 'piltover']), 'nooo i cry', 'pilt', () => 0.05)).toBe(
		'nooo i cry <:sadcry:0>'
	);
});

test('no emoji when only a substring matches', async () => {
	expect(await withServerEmoji(guildWith(['piltover']), 'go pilt', 'pilt', () => 0.05)).toBe('go pilt');
});
