const BOT_NAME = /\b(?:jessjessbot|jjb)\b/iu;
const LEADING_BOT_NAME = /^\s*(?:jessjessbot|jjb)\b[,:]?\s*/iu;

// Discord's @ autocomplete offers her managed "jjb" role next to her account, and people
// pick it by accident. A ping of that role is a ping of her.
export function botRoleAsMention(content: string, botId: string, botRoleId?: string | null): string {
	return botRoleId ? content.replaceAll(`<@&${botRoleId}>`, `<@${botId}>`) : content;
}

export function botPrompt(
	content: string,
	botId: string,
	directlyMentioned: boolean,
	replyingToBot = false,
	hasAttachments = false
): string | null {
	const mention = new RegExp(`<@!?${botId}>`, 'u');
	// A bare ping with nothing attached belongs to Meowdule; answering here too would
	// send two replies.
	if (
		directlyMentioned &&
		!hasAttachments &&
		!content.replace(new RegExp(`<@!?${botId}>`, 'gu'), '').trim()
	)
		return null;
	if (directlyMentioned && mention.test(content)) {
		const leadingMention = new RegExp(`^\\s*<@!?${botId}>[,:]?\\s*`, 'u');
		return (
			(leadingMention.test(content)
				? content.replace(leadingMention, '')
				: content.replace(mention, 'jjb')
			).trim() || 'hey'
		);
	}
	if (replyingToBot) return content.trim() || 'hey';
	if (!BOT_NAME.test(content)) return null;
	return content.replace(LEADING_BOT_NAME, '').trim() || 'hey';
}
