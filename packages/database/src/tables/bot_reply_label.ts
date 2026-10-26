import { DatabaseConnection } from '../connection';

export type BotReplyRating = 'good' | 'bad';

export type BotReplyLabel = {
	messageId: string;
	guildId: string;
	channelId: string;
	rating: BotReplyRating;
	reason: string | null;
	reply: string;
	prompt: string | null;
	labeledById: string;
};

export class BotReplyLabelTable extends DatabaseConnection {
	/** Saves a label, replacing any earlier one on the same message. */
	async save(label: BotReplyLabel): Promise<void> {
		const { messageId, ...data } = label;
		await this._db.botReplyLabel.upsert({
			where: { messageId },
			create: label,
			update: data,
		});
	}
}
