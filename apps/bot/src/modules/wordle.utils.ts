import { Collection, GuildMember, type Snowflake } from 'discord.js';

export function get_users_from_failed_mentions(
	failed_mentions: Set<string>,
	users: Collection<Snowflake, GuildMember>
): { winners: GuildMember[]; failed_mentions: Set<string> } {
	const winners = new Array<GuildMember>();
	const members = Array.from(users.values());

	for (const member of members) {
		if (failed_mentions.has(member.displayName)) {
			winners.push(member);
			failed_mentions.delete(member.displayName);
		}
	}

	return {
		winners,
		failed_mentions,
	};
}

const failed_mention_regex = /\s@([^@<]+?)(?=\s*@|\s*<|$)/g;
const mention_regex = /<@!?(\d+)>/g;
const score_regex = /(\d|X)\/6:/;

export function parse_wordle_message_v2(message: string) {
	if (!message.includes("Here are yesterday's results:")) return;
	const scores: Record<
		string,
		{
			failed_mentions: Array<{ text: string; startOfMention: number }>;
			mentions: Set<string>;
			winners: boolean;
		}
	> = {};

	let winnersAreSet = false;
	let lineOffset = 0;

	for (const line of message.split('\n')) {
		const scoreMatch = line.match(score_regex);
		if (scoreMatch) {
			const score = scoreMatch[1];
			const failed_mentions: Array<{ text: string; startOfMention: number }> = [];
			for (const match of line.matchAll(failed_mention_regex)) {
				failed_mentions.push({ text: match[1], startOfMention: lineOffset + match.index });
			}
			const mentions = [...line.matchAll(mention_regex)].map((match) => match[1]);
			if (!winnersAreSet && score !== 'X') {
				winnersAreSet = true;
				scores[score] = {
					winners: true,
					failed_mentions,
					mentions: new Set(mentions),
				};
			} else {
				scores[score] = {
					winners: false,
					failed_mentions,
					mentions: new Set(mentions),
				};
			}
		}
		lineOffset += line.length + 1;
	}

	return scores;
}
