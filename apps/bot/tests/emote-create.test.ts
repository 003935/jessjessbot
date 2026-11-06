/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { PermissionsBitField } from 'discord.js';
import {
	cleanEmoteName,
	createEmote,
	emotePermissionProblem,
	emoteSourceFrom,
	isEmoteCancellation,
	isEmoteRequest,
	nameFromReply,
} from '../src/modules/emote-create';

const member = (...flags: bigint[]) => ({ permissions: new PermissionsBitField(flags) }) as any;
const message = (attachments: Array<{ url: string; contentType?: string; name?: string }>, content = '') => ({
	content,
	attachments: new Map(attachments.map((a, i) => [String(i), a])),
});

function guildWith(names: string[], create: (options: any) => Promise<any> = async ({ name }) => ({ toString: () => `<:${name}:1>` })) {
	const created: any[] = [];
	return {
		created,
		emojis: {
			fetch: async () => new Map(names.map((name, i) => [String(i), { name }])),
			create: async (options: any) => {
				created.push(options);
				return create(options);
			},
		},
	} as any;
}

const image = (bytes = 10) => (async () => new Response(new Uint8Array(bytes))) as any;

test('recognises emote requests', () => {
	expect(isEmoteRequest('add this as an emote')).toBe(true);
	expect(isEmoteRequest('can u make an emoji called catjam')).toBe(true);
	expect(isEmoteRequest('steal this emote <:catjam:123456789012345678>')).toBe(true);
	expect(isEmoteRequest('what emotes do we have')).toBe(false);
	expect(isEmoteRequest('add me to the league role')).toBe(false);
});

test('emote names follow discord rules', () => {
	expect(cleanEmoteName('catjam')).toBe('catjam');
	expect(cleanEmoteName(':cat_jam:')).toBe('cat_jam');
	expect(cleanEmoteName('cat jam')).toBe('cat_jam');
	expect(cleanEmoteName('x')).toBeNull();
	expect(cleanEmoteName('café')).toBeNull();
	expect(cleanEmoteName('a'.repeat(33))).toBeNull();
	expect(cleanEmoteName(undefined)).toBeNull();
});

test('reads a name from the follow-up', () => {
	expect(nameFromReply('catjam')).toBe('catjam');
	expect(nameFromReply(':catjam:')).toBe('catjam');
	expect(nameFromReply('call it sad cat')).toBe('sad_cat');
	expect(nameFromReply('name it "bonk".')).toBe('bonk');
	expect(nameFromReply('what are we playing tonight anyway')).toBeNull();
	expect(isEmoteCancellation('nvm')).toBe(true);
	expect(isEmoteCancellation('catjam')).toBe(false);
});

test('only admins can add emotes, and jjb needs manage expressions', () => {
	const bot = member(PermissionsBitField.Flags.ManageGuildExpressions);
	expect(emotePermissionProblem(member(), bot)).toContain('only admins');
	expect(emotePermissionProblem(member(PermissionsBitField.Flags.ManageGuildExpressions), bot)).toContain('only admins');
	expect(emotePermissionProblem(member(PermissionsBitField.Flags.Administrator), member())).toContain('Manage Expressions');
	expect(emotePermissionProblem(member(PermissionsBitField.Flags.Administrator), bot)).toBeNull();
});

test('finds the image from an attachment, a pasted emote, or the replied message', () => {
	const png = { url: 'https://cdn.example/cat.png', contentType: 'image/png' };
	expect(emoteSourceFrom('add this', message([png]))).toEqual({ url: png.url });
	expect(emoteSourceFrom('steal <a:dance:123456789012345678>', message([]))).toEqual({
		url: 'https://cdn.discordapp.com/emojis/123456789012345678.gif',
	});
	expect(emoteSourceFrom('add that', message([]), [message([png])])).toEqual({ url: png.url });
	expect(
		emoteSourceFrom('add that', message([{ url: 'https://cdn.example/a.txt', contentType: 'text/plain' }]))
	).toBeNull();
	expect(emoteSourceFrom('add an emote', message([]))).toBeNull();
});

test('creates the emote with the given name', async () => {
	const guild = guildWith([]);
	const result = await createEmote(guild, { url: 'https://cdn.example/cat.png' }, 'catjam', 'test', image());
	expect(result.reply).toContain('<:catjam:1>');
	expect(guild.created[0].name).toBe('catjam');
});

test('asks for another name when it is taken', async () => {
	const guild = guildWith(['CatJam']);
	const result = await createEmote(guild, { url: 'x' }, 'catjam', 'test', image());
	expect(result.askAgain).toBe(true);
	expect(guild.created).toHaveLength(0);
});

test('refuses images over 256kb and reports a full server', async () => {
	expect((await createEmote(guildWith([]), { url: 'x' }, 'big', 'test', image(300 * 1024))).reply).toContain('too big');
	const full = guildWith([], async () => {
		throw Object.assign(new Error('Maximum emojis reached'), { code: 30008 });
	});
	expect((await createEmote(full, { url: 'x' }, 'catjam', 'test', image())).reply).toContain('out of emote slots');
});
