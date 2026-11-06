/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { PermissionsBitField } from 'discord.js';
import sharp from 'sharp';
import {
	cleanEmoteName,
	createEmote,
	emotePermissionProblem,
	emoteSourceFrom,
	fitEmote,
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

// Random pixels don't compress, so these come out well over 256kb.
const noise = (width: number, height: number, frames = 1) =>
	sharp(Buffer.from(Array.from({ length: width * height * frames * 3 }, () => Math.floor(Math.random() * 256))), {
		raw: { width, height: height * frames, channels: 3, pageHeight: height },
	} as any);
const serve = (bytes: Buffer) => (async () => new Response(new Uint8Array(bytes))) as any;

test('shrinks big images to fit an emote', async () => {
	const big = await noise(600, 600).png().toBuffer();
	expect(big.byteLength).toBeGreaterThan(256 * 1024);
	const guild = guildWith([]);
	const result = await createEmote(guild, { url: 'x' }, 'big', 'test', serve(big));
	expect(result.reply).toContain('<:big:1>');
	const uploaded: Buffer = guild.created[0].attachment;
	expect(uploaded.byteLength).toBeLessThanOrEqual(256 * 1024);
	const { width, height } = await sharp(uploaded).metadata();
	expect(Math.max(width!, height!)).toBeLessThanOrEqual(128);
});

test('keeps big gifs animated when shrinking them', async () => {
	const gif = await noise(400, 400, 4).gif().toBuffer();
	expect(gif.byteLength).toBeGreaterThan(256 * 1024);
	const fitted = await fitEmote(gif);
	expect(fitted!.byteLength).toBeLessThanOrEqual(256 * 1024);
	expect((await sharp(fitted!, { animated: true }).metadata()).pages).toBe(4);
});

test('leaves small images alone and rejects non-images', async () => {
	const small = await noise(32, 32).png().toBuffer();
	expect(await fitEmote(small)).toBe(small);
	const junk = Buffer.alloc(300 * 1024, 7);
	expect((await createEmote(guildWith([]), { url: 'x' }, 'junk', 'test', serve(junk))).reply).toContain("couldn't read");
});

test('reports a full server', async () => {
	const full = guildWith([], async () => {
		throw Object.assign(new Error('Maximum emojis reached'), { code: 30008 });
	});
	expect((await createEmote(full, { url: 'x' }, 'catjam', 'test', image())).reply).toContain('out of emote slots');
});
