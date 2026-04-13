import { Message } from 'discord.js';
import { YUM_CHANNEL_ID } from '@/environment';
import { Logger } from '@/utils';

const logger = new Logger('Reaction');

export async function Check_Attachments(message: Message<true>) {
	if (message.channel.id !== YUM_CHANNEL_ID) return;
	const hasAttachments = message.attachments.size > 0;
	if (!hasAttachments) return;
	const hasAttachmentsWithImageOrVideo = message.attachments.some(
		(attachment) =>
			attachment.contentType?.startsWith('image/') || attachment.contentType?.startsWith('video/')
	);
	if (!hasAttachmentsWithImageOrVideo) return;
	try {
		await message.react('🔥');
	} catch (error) {
		logger.error(`Failed to react to message ${message.id}:`, error);
	}
}
