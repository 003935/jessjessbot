import { Collection, GuildMember, Message, type Snowflake } from 'discord.js';
import { YUM_CHANNEL_ID } from '@/environment';

export async function Check_Attachments(message: Message<true>) {
	const contentType = message.attachments.first()?.contentType;
	if (message.channel.id !== YUM_CHANNEL_ID) return;
	if (!message.attachments) return;
	if (contentType?.startsWith('image/') === false && contentType?.startsWith('video/') === false)
		return;
	await message.react('🔥');
}
