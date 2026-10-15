import type { Attachment, Message } from 'discord.js';
import { askDeepSeek, isPublicChannel } from '@/modules/mention';
import { botPrompt } from '@/modules/mention-trigger';
import { isImageOrVideoExcludeGif } from '@/modules/reaction';
import { filterBotOutput } from '@/modules/output-filter';
import { collectVisionImages, type VisionImageAttachment } from '@/modules/vision-images';
import { Logger } from '@/utils';

const logger = new Logger('MediaReplies');

export function mediaReplyKind(message: Message, replyingToBot = false): 'food' | 'pet' | null {
	if (message.author.bot) return null;
	const kind =
		process.env.YUM_CHANNEL_ID && message.channelId === process.env.YUM_CHANNEL_ID
			? 'food'
			: process.env.PET_CHANNEL_ID && message.channelId === process.env.PET_CHANNEL_ID
				? 'pet'
				: null;
	if (!kind || replyingToBot) return null;
	return botPrompt(
		message.content,
		message.client.user.id,
		message.mentions.users.has(message.client.user.id)
	) === null
		? kind
		: null;
}

export async function handleMediaReply(message: Message<true>): Promise<boolean> {
	const initialKind = mediaReplyKind(message);
	if (!initialKind || !isPublicChannel(message)) return false;
	const referenced = message.reference?.messageId
		? await message.fetchReference().catch(() => null)
		: null;
	const kind = mediaReplyKind(message, referenced?.author.id === message.client.user.id);
	if (!kind) return false;
	const attachments = [...message.attachments.values()].filter((attachment) =>
		isImageOrVideoExcludeGif(attachment.contentType)
	);
	const links: Array<{ url: string; contentType: string; size: number }> = [];
	if (!attachments.length) {
		for (const url of message.content.match(/https?:\/\/[^\s<>]+/gu) ?? []) {
			try {
				const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
				const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
				if (response.ok && isImageOrVideoExcludeGif(contentType))
					links.push({
						url,
						contentType,
						size: Number(response.headers.get('content-length')) || 0,
					});
			} catch (error) {
				logger.error(`Could not inspect media link in message ${message.id}`, error);
			}
		}
	}
	if (!attachments.length && !links.length) return false;
	const imageAttachments: VisionImageAttachment[] = [
		...attachments
			.filter((attachment) => attachment.contentType?.startsWith('image/'))
			.map((attachment) => ({ attachment, messageId: message.id })),
		...links
			.filter((link) => link.contentType.startsWith('image/'))
			.map((link) => ({ attachment: link as Attachment, messageId: message.id })),
	];
	const { images } = await collectVisionImages(imageAttachments);
	if (imageAttachments.length && !images.length) return false;
	const videoOnly = !images.length;
	const caption = message.content
		.replace(/https?:\/\/[^\s<>]+/gu, '')
		.trim()
		.slice(0, 500);
	const prompt = caption || (videoOnly ? 'video attached' : 'photo attached');
	try {
		await message.channel.sendTyping();
		const response = await askDeepSeek(
			prompt,
			[],
			false,
			null,
			0,
			null,
			false,
			false,
			message.member?.displayName ?? message.author.globalName ?? message.author.username,
			null,
			message.author.username,
			message.author.username,
			images,
			[],
			null,
			null,
			null,
			undefined,
			message.channelId,
			kind
		);
		if (!response.reply) return false;
		await message.reply({
			content: filterBotOutput(response.reply.slice(0, 1900)),
			allowedMentions: { parse: [], repliedUser: false },
		});
		return true;
	} catch (error) {
		logger.error(`Could not reply to media message ${message.id}`, error);
		return false;
	}
}
