import { Message } from 'discord.js';
import { YUM_CHANNEL_ID } from '@/environment';

export async function Check_Attachments(message: Message<true>) {
	if (message.channel.id !== YUM_CHANNEL_ID) return;
	const hasAttachments = message.attachments.size > 0;
	if (!hasAttachments) return;
	const hasAttachmentsWithImageOrVideo = message.attachments.some(
		(attachment) =>
			attachment.contentType?.startsWith('image/') || attachment.contentType?.startsWith('video/')
	);
	if (!hasAttachmentsWithImageOrVideo) return;
	await message.react('🔥');
}
