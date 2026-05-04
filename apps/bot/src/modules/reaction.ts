import { Message } from 'discord.js';
import { YUM_CHANNEL_ID } from '@/environment';
import { Logger } from '@/utils';

const logger = new Logger('Reaction');

function isImageOrVideoExcludeGif(contentType: string | null | undefined): boolean {
	return (
		(contentType?.startsWith('image/') &&
			contentType !== 'image/gif' &&
			contentType !== 'image/x-gif') ||
		contentType?.startsWith('video/') ||
		false
	);
}

export function hasImageOrVideoAttachment(message: Message<boolean>): boolean {
	const ret = message.attachments.some((attachment) =>
		isImageOrVideoExcludeGif(attachment.contentType)
	);
	return ret;
}

export async function hasImageOrVideoLink(message: Message<boolean>): Promise<boolean> {
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	const urls = message.content.match(urlRegex) || [];

	const results = await Promise.all(
		urls.map(async (url) => {
			try {
				const res = await fetch(url, { method: 'HEAD' });
				const contentType = res.headers.get('content-type');
				return isImageOrVideoExcludeGif(contentType);
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
	if (message.channel.id !== YUM_CHANNEL_ID) return;

	try {
		if (hasImageOrVideoAttachment(message) || (await hasImageOrVideoLink(message))) {
			try {
				await message.react('🔥');
			} catch (error) {
				logger.error(`Failed to react to message ${message.id}:`, error);
			}
		}
	} catch (error) {
		logger.error(`Error processing message ${message.id}:`, error);
	}
}
