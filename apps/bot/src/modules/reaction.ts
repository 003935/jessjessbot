import { Message } from 'discord.js';
import { PET_CHANNEL_ID, YUM_CHANNEL_ID } from '@/environment';
import { Logger } from '@/utils';

const logger = new Logger('Reaction');

export function isImageOrVideoExcludeGif(contentType: string | null | undefined, imagesOnly = false): boolean {
	return (
		(contentType?.startsWith('image/') &&
			contentType !== 'image/gif' &&
			contentType !== 'image/x-gif') ||
		(!imagesOnly && contentType?.startsWith('video/')) ||
		false
	);
}

export function hasImageOrVideoAttachment(message: Message<boolean>, imagesOnly = false): boolean {
	const ret = message.attachments.some((attachment) =>
		isImageOrVideoExcludeGif(attachment.contentType, imagesOnly)
	);
	return ret;
}

const MAX_LINKS_CHECKED = 3;
const LINK_CHECK_TIMEOUT_MS = 5_000;

function isPrivateIPv4(host: string): boolean {
	const parts = host.split('.').map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
		return false;
	const [a, b] = parts as [number, number, number, number];
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 100 && b >= 64 && b <= 127)
	);
}

function isPrivateIPv6(host: string): boolean {
	const ip = host.replace(/^\[|\]$/g, '').toLowerCase();
	if (!ip.includes(':')) return false;
	if (ip === '::' || ip === '::1') return true;
	if (/^f[cd][0-9a-f]{0,2}:/.test(ip)) return true; // fc00::/7 unique local
	if (/^fe[89ab][0-9a-f]?:/.test(ip)) return true; // fe80::/10 link-local
	const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	return mapped ? isPrivateIPv4(mapped[1]!) : ip.startsWith('::ffff:');
}

/** Only fetch public http(s) hosts, so a posted link can't make the bot probe internal services. */
export function isSafePublicUrl(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
	const host = url.hostname.toLowerCase().replace(/\.$/, '');
	if (!host || (!host.includes('.') && !host.includes(':'))) return false; // localhost, `omnivoice`, etc.
	if (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host.endsWith('.local') ||
		host.endsWith('.internal') ||
		host.endsWith('.lan') ||
		host.endsWith('.home.arpa')
	)
		return false;
	return !isPrivateIPv4(host) && !isPrivateIPv6(host);
}

export async function hasImageOrVideoLink(message: Message<boolean>, imagesOnly = false): Promise<boolean> {
	const urlRegex = /(https?:\/\/[^\s<>]+)/g;
	const urls = (message.content.match(urlRegex) || [])
		.filter(isSafePublicUrl)
		.slice(0, MAX_LINKS_CHECKED);

	const results = await Promise.all(
		urls.map(async (url) => {
			try {
				const res = await fetch(url, {
					method: 'HEAD',
					redirect: 'manual',
					signal: AbortSignal.timeout(LINK_CHECK_TIMEOUT_MS),
				});
				if (!res.ok) return false;
				const contentType = res.headers.get('content-type');
				return isImageOrVideoExcludeGif(contentType, imagesOnly);
			} catch (error) {
				logger.error(`Failed to fetch URL ${url}:`, error);
				return false;
			}
		})
	);

	const ret = results.some((result) => result);
	return ret;
}

export async function Check_Attachments(message: Message<boolean>) {
	const isYumChannel = Boolean(YUM_CHANNEL_ID && message.channel.id === YUM_CHANNEL_ID);
	const isPetChannel = Boolean(PET_CHANNEL_ID && message.channel.id === PET_CHANNEL_ID);
	if (!isYumChannel && !isPetChannel) return;

	try {
		const imagesOnly = isPetChannel;
		if (hasImageOrVideoAttachment(message, imagesOnly) || (await hasImageOrVideoLink(message, imagesOnly))) {
			try {
				await message.react(isPetChannel ? '❤️' : '🔥');
			} catch (error) {
				logger.error(`Failed to react to message ${message.id}:`, error);
			}
		}
	} catch (error) {
		logger.error(`Error processing message ${message.id}:`, error);
	}
}
