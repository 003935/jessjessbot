import type { Message } from 'discord.js';

const GG_FKIN_EZ = /\bgg\s+fkin\s+ez\b/iu;
const HEY_DONT_SAY_THAT = /^\s*hey\s+don'?t\s+say\s+that[!?.\s]*$/iu;
const REPLY_COOLDOWN_MS = 60_000;
const CHAIN_TTL_MS = 2 * 60_000;
const EZ_REPLIES = ['fuken ez', 'friggin ez', 'fuggen ez'];
const lastReplyByChannel = new Map<string, number>();
const botGgByChannel = new Map<string, { expiresAt: number }>();
let lastEzReply = '';

export async function handleMemeReply(message: Message<true>): Promise<boolean> {
	const now = Date.now();
	for (const [channelId, lastReply] of lastReplyByChannel) {
		if (now - lastReply >= REPLY_COOLDOWN_MS) lastReplyByChannel.delete(channelId);
	}
	for (const [channelId, chain] of botGgByChannel) {
		if (chain.expiresAt <= now) botGgByChannel.delete(channelId);
	}

	if (message.author.id === message.client.user.id) {
		if (GG_FKIN_EZ.test(message.content))
			botGgByChannel.set(message.channelId, {
				expiresAt: now + CHAIN_TTL_MS,
			});
		else botGgByChannel.delete(message.channelId);
		return false;
	}
	if (message.author.bot) return false;

	const botGg = botGgByChannel.get(message.channelId);
	if (botGg && HEY_DONT_SAY_THAT.test(message.content)) {
		botGgByChannel.delete(message.channelId);
		const options = EZ_REPLIES.filter((reply) => reply !== lastEzReply);
		const reply = options[Math.floor(Math.random() * options.length)]!;
		try {
			await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
			lastEzReply = reply;
		} catch (error) {
			botGgByChannel.set(message.channelId, botGg);
			throw error;
		}
		return true;
	}
	botGgByChannel.delete(message.channelId);
	if (!GG_FKIN_EZ.test(message.content)) return false;

	if (now - (lastReplyByChannel.get(message.channelId) ?? 0) < REPLY_COOLDOWN_MS)
		return true;

	lastReplyByChannel.set(message.channelId, now);
	try {
		await message.reply({ content: 'hey dont say that', allowedMentions: { repliedUser: false } });
	} catch (error) {
		lastReplyByChannel.delete(message.channelId);
		throw error;
	}
	return true;
}
