export function Score_To_String(score: number): string {
	if (score >= 1 && score <= 6) {
		return score.toString();
	}
	if (score === 7) {
		return 'DNF';
	}
	return 'Unknown';
}

export interface WordleResultMessage {
	guildId: string;
	messageId: string;
	channelId: string;
	messageTimestamp: Date;
	winningScore: number | null;
	players: Map<
		string,
		{
			discordId: string;
			score: number;
		}
	>;
	failedMentions: Map<
		number,
		{
			displayName: string;
			score: number;
			startOfMention: number;
		}
	>;
}

export function Tries_To_Score(tries: string): number {
	switch (tries) {
		case '1':
			return 1;
		case '2':
			return 2;
		case '3':
			return 3;
		case '4':
			return 4;
		case '5':
			return 5;
		case '6':
			return 6;
		case 'X':
			return 7;
		default:
			console.error(`Invalid tries value: ${tries}, defaulting to DNF`);
			return 7;
	}
}

export * from './generated/prisma/enums';
