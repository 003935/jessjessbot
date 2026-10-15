const BOT_NAME = /\b(?:jessjessbot|jjb)\b/iu;
const LEADING_BOT_NAME = /^\s*(?:jessjessbot|jjb)\b[,:]?\s*/iu;

export function botPrompt(
	content: string,
	botId: string,
	directlyMentioned: boolean,
	replyingToBot = false
): string | null {
	const mention = new RegExp(`<@!?${botId}>`, 'u');
	if (directlyMentioned && mention.test(content)) {
		const leadingMention = new RegExp(`^\\s*<@!?${botId}>[,:]?\\s*`, 'u');
		return (leadingMention.test(content)
			? content.replace(leadingMention, '')
			: content.replace(mention, 'jjb')).trim() || 'hey';
	}
	if (replyingToBot) return content.trim() || 'hey';
	if (!BOT_NAME.test(content)) return null;
	return content.replace(LEADING_BOT_NAME, '').trim() || 'hey';
}
