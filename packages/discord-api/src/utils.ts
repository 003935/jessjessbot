import { type WordleResultMessage, Tries_To_Score } from '@repo/database/utils';

const failed_mention_regex = /\s@([^@<]+?)(?=\s*@|\s*<|$)/g;
const mention_regex = /<@!?(\d+)>/g;
const score_regex = /(\d|X)\/6:/;

interface Message {
	guildId: string;
	messageId: string;
	channelId: string;
	messageTimestamp: Date;
	content: string;
}

export function parse_wordle_message_v2(message: Message): WordleResultMessage | null {
	if (!message.content.includes("Here are yesterday's results:")) return null;

	const result: WordleResultMessage = {
		guildId: message.guildId,
		messageId: message.messageId,
		channelId: message.channelId,
		messageTimestamp: message.messageTimestamp,
		winningScore: null,
		players: new Map(),
		failedMentions: new Map(),
	};

	let lineOffset = 0;

	for (const line of message.content.split('\n')) {
		const scoreMatch = line.match(score_regex);
		if (scoreMatch) {
			const score = Tries_To_Score(scoreMatch[1]);

			// set the winning score
			if (result.winningScore === null && score !== 7) {
				result.winningScore = score;
			}

			const mentions = [...line.matchAll(mention_regex)].map((match) => match[1]);
			mentions.forEach((mention) => {
				result.players.set(mention, {
					discordId: mention,
					score: score,
				});
			});

			const failedMention_matches = [...line.matchAll(failed_mention_regex)];
			for (const match of failedMention_matches) {
				const startOfMention = lineOffset + match.index;
				result.failedMentions.set(startOfMention, {
					displayName: match[1],
					score: score,
					startOfMention,
				});
			}
		}
		lineOffset += line.length + 1;
	}

	return result;
}

type HallTextMessage = {
	content: string;
	components?: unknown;
	embeds?: readonly {
		title?: string | null;
		description?: string | null;
		fields?: readonly { name: string; value: string }[];
	}[];
};

export function hallMessageText(message: HallTextMessage): string {
	if (message.content.trim()) return message.content;

	const text: string[] = [];
	const visit = (components: unknown) => {
		if (!Array.isArray(components)) return;
		for (const component of components) {
			if (typeof component !== 'object' || component === null) continue;
			if (component.type === 10 && typeof component.content === 'string')
				text.push(component.content);
			visit(component.components);
		}
	};
	visit(message.components);
	if (text.length) return text.join(' ');

	for (const embed of message.embeds ?? []) {
		if (embed.title) text.push(embed.title);
		if (embed.description) text.push(embed.description);
		for (const field of embed.fields ?? []) text.push(field.name, field.value);
	}
	return text.join(' ');
}
