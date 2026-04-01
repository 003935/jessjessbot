import { DatabaseConnection } from '../connection';
import { winnersTable } from '../schema';
import { eq, and, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

type User = {
	id: string;
	wins: number;
};

type UserWin = InferSelectModel<typeof winnersTable>;
type InsertUserWin = InferInsertModel<typeof winnersTable>;

export class WordleTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async size(): Promise<number> {
		return await this._db.$count(winnersTable);
	}

	async getSortedWinners(limit: number = 5): Promise<User[]> {
		const win_entries = await this._db
			.select()
			.from(winnersTable)
			.where(eq(winnersTable.winner, true));
		const users = new Map<string, number>();
		for (const win_entry of win_entries) {
			users.set(win_entry.discordId, (users.get(win_entry.discordId) || 0) + 1);
		}
		const sorted_users = Array.from(users.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit);
		return sorted_users.map(([id, wins]) => ({ id, wins }));
	}

	async getUser(id: string): Promise<User | null> {
		const win_entries = await this._db
			.select()
			.from(winnersTable)
			.where(and(eq(winnersTable.discordId, id), eq(winnersTable.winner, true)));
		return {
			id,
			wins: win_entries.length,
		};
	}

	async addWin(win: InsertUserWin) {
		await this._db.transaction(async (tx) => {
			const win_entry = await tx
				.select()
				.from(winnersTable)
				.where(
					and(
						eq(winnersTable.discordId, win.discordId),
						eq(winnersTable.channelId, win.channelId),
						eq(winnersTable.messageId, win.messageId)
					)
				);
			if (win_entry.length === 0) {
				await tx.insert(winnersTable).values({
					discordId: win.discordId,
					messageId: win.messageId,
					channelId: win.channelId,
					message_timestamp: win.message_timestamp,
					score: win.score,
					winner: win.winner,
				});
			}
		});
	}

	async addWins(wins: InsertUserWin[]) {
		if (wins.length === 0) return;

		await this._db
			.insert(winnersTable)
			.values(wins)
			.onConflictDoNothing({
				target: [winnersTable.discordId, winnersTable.channelId, winnersTable.messageId],
			});
	}
}
