import { DatabaseConnection } from '../connection';
import { winnersTable } from '../schema';
import { eq, and } from 'drizzle-orm';

type User = {
  id: string;
  wins: number;
};

export class WordleTable extends DatabaseConnection {
  constructor(db_conn: DatabaseConnection) {
    super(db_conn);
  }

  async size(): Promise<number> {
    return await this._db.$count(winnersTable);
  }

  async getSortedWinners(limit: number = 5): Promise<User[]> {
    const win_entries = await this._db.select().from(winnersTable);
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
    const win_entries = await this._db.select().from(winnersTable).where(eq(winnersTable.discordId, id));
    return {
      id,
      wins: win_entries.length
    };
  }

  async addWin(userId: string, messageId: string) {
    await this._db.transaction(async (tx) => {
      const win_entry = await tx
        .select()
        .from(winnersTable)
        .where(and(eq(winnersTable.discordId, userId), eq(winnersTable.messageId, messageId)));
      if (win_entry.length === 0) {
        await tx.insert(winnersTable).values({ discordId: userId, messageId });
      }
    });
  }
}
