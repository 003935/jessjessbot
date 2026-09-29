import { Message } from 'discord.js';
import { PET_CHANNEL_ID, YUM_CHANNEL_ID } from '@/environment';
import { Logger } from '@/utils';

const logger = new Logger('Reaction');

function isImageOrVideoExcludeGif(contentType: string | null | undefined, imagesOnly = false): boolean {
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

export async function hasImageOrVideoLink(message: Message<boolean>, imagesOnly = false): Promise<boolean> {
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	const urls = message.content.match(urlRegex) || [];

	const results = await Promise.all(
		urls.map(async (url) => {
			try {
				const res = await fetch(url, { method: 'HEAD' });
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
