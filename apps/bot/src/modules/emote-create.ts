import { PermissionsBitField, type Guild, type GuildMember } from 'discord.js';
import sharp from 'sharp';

// jjb adds server emotes through the add_emote tool; code decides who may and what gets uploaded.

export const EMOTE_NAME_TTL_MS = 5 * 60 * 1000;
// Discord's upload limit for emojis.
const MAX_EMOTE_BYTES = 256 * 1024;
// Discord shows emotes at 128px at most, so bigger images get shrunk to fit.
const EMOTE_EDGES = [128, 96, 64];
const IMAGE_TYPES = /^image\/(?:png|jpe?g|gif|webp)$/iu;
const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|gif|webp)(?:\?|$)/iu;

export type EmoteSource = { url: string };
export type PendingEmote = { source: EmoteSource; expiresAt: number };

type AttachmentLike = { url: string; contentType?: string | null; name?: string | null; size?: number };
type MessageLike = { content?: string; attachments: { values(): Iterable<AttachmentLike> } };

export function isEmoteRequest(input: string): boolean {
	return /\b(?:add|make|create|upload|turn|steal|save|put)\b.*\b(?:emotes?|emojis?)\b/iu.test(input);
}

export function isEmoteCancellation(input: string): boolean {
	return /^(?:cancel|no|nope|nvm|never ?mind|forget it)(?:[!. ]*)$/iu.test(input.trim());
}

/** Discord emote names are 2–32 letters, numbers or underscores; spaces and dashes become underscores. */
export function cleanEmoteName(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const name = raw
		.trim()
		.replace(/^:+|:+$/gu, '')
		.replace(/[\s-]+/gu, '_');
	return /^[A-Za-z0-9_]{2,32}$/u.test(name) ? name : null;
}

/** The name from a follow-up like "catjam", ":catjam:", "call it catjam" or "name it cat jam". */
export function nameFromReply(input: string): string | null {
	const text = input.trim().replace(/[.!]+$/u, '');
	const named = text.match(/\b(?:name|call)\s+it\s+(.+)$/iu)?.[1] ?? text;
	const quoted = named.replace(/^["“'`]+|["”'`]+$/gu, '');
	// A whole sentence is someone changing the subject, not a name.
	if (quoted.split(/\s+/u).length > 3) return null;
	return cleanEmoteName(quoted);
}

function isImage(attachment: AttachmentLike): boolean {
	return (
		(!!attachment.contentType && IMAGE_TYPES.test(attachment.contentType)) ||
		IMAGE_EXTENSIONS.test(attachment.name ?? '') ||
		(!attachment.contentType && IMAGE_EXTENSIONS.test(attachment.url))
	);
}

/** The image to upload: one sent with the message, an emote pasted in it, or an image on the message it replies to. */
export function emoteSourceFrom(prompt: string, own: MessageLike, referenced: MessageLike[] = []): EmoteSource | null {
	const attached = [...own.attachments.values()].find(isImage);
	if (attached) return { url: attached.url };
	const pasted = prompt.match(/<(a?):\w+:(\d{17,20})>/u);
	if (pasted) return { url: `https://cdn.discordapp.com/emojis/${pasted[2]}.${pasted[1] ? 'gif' : 'png'}` };
	for (const message of referenced) {
		const image = [...message.attachments.values()].find(isImage);
		if (image) return { url: image.url };
		const emote = message.content?.match(/<(a?):\w+:(\d{17,20})>/u);
		if (emote) return { url: `https://cdn.discordapp.com/emojis/${emote[2]}.${emote[1] ? 'gif' : 'png'}` };
	}
	return null;
}

export function emotePermissionProblem(
	actor: Pick<GuildMember, 'permissions'>,
	bot: Pick<GuildMember, 'permissions'>
): string | null {
	if (!actor.permissions.has(PermissionsBitField.Flags.Administrator)) return 'only admins can add emotes (・_・;)';
	if (!bot.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions))
		return 'i need the Manage Expressions permission first';
	return null;
}

/** Shrinks an image that's over Discord's emote limit, keeping animation. Null when it still won't fit; throws when it isn't an image. */
export async function fitEmote(image: Buffer): Promise<Buffer | null> {
	if (image.byteLength <= MAX_EMOTE_BYTES) return image;
	const metadata = await sharp(image, { animated: true }).metadata();
	const animated = (metadata.pages ?? 1) > 1;
	for (const edge of EMOTE_EDGES) {
		const resized = () =>
			sharp(image, { animated })
				.rotate()
				.resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });
		const outputs = animated
			? [() => resized().gif().toBuffer(), () => resized().webp({ quality: 80 }).toBuffer()]
			: [() => resized().png().toBuffer(), () => resized().webp({ quality: 80 }).toBuffer()];
		for (const output of outputs) {
			const shrunk = await output();
			if (shrunk.byteLength <= MAX_EMOTE_BYTES) return shrunk;
		}
	}
	return null;
}

export type EmoteResult = { reply: string; askAgain?: boolean };

export async function createEmote(
	guild: Pick<Guild, 'emojis'>,
	source: EmoteSource,
	name: string,
	reason: string,
	fetchImage: typeof fetch = fetch
): Promise<EmoteResult> {
	const existing = await guild.emojis.fetch();
	if ([...existing.values()].some((emoji) => emoji.name?.toLocaleLowerCase() === name.toLocaleLowerCase()))
		return { reply: `there's already a :${name}: emote, pick another name?`, askAgain: true };
	let image: Buffer;
	try {
		const response = await fetchImage(source.url, { signal: AbortSignal.timeout(15_000) });
		if (!response.ok) return { reply: "i couldn't download that image (・_・;)" };
		image = Buffer.from(await response.arrayBuffer());
	} catch {
		return { reply: "i couldn't download that image (・_・;)" };
	}
	let fitted: Buffer | null;
	try {
		fitted = await fitEmote(image);
	} catch {
		return { reply: "i couldn't read that image (・_・;)" };
	}
	if (!fitted) return { reply: "that image is too big for an emote even after shrinking it (・_・;)" };
	image = fitted;
	try {
		const emoji = await guild.emojis.create({ attachment: image, name, reason });
		return { reply: `added ${emoji.toString()} :${name}:` };
	} catch (error) {
		const code = (error as { code?: unknown }).code;
		if (code === 30008) return { reply: 'the server is out of emote slots (╥﹏╥)' };
		if (code === 50013) return { reply: 'i need the Manage Expressions permission first' };
		return { reply: "discord wouldn't take that one (・_・;)" };
	}
}
