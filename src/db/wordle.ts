import { InferSelectModel, eq, desc } from "drizzle-orm";
import { winnersTable } from "./schema";
import { db } from ".";

type User = InferSelectModel<typeof winnersTable>;

export class WinnersTable {
  static async size(): Promise<number> {
    return await db.$count(winnersTable);
  }

  static async getSortedWinners(limit: number = 5): Promise<User[]> {
    const users = await db.select().from(winnersTable).orderBy(desc(winnersTable.wins)).limit(limit);
    return users;
  }

  static async getUser(id: string): Promise<User | null> {
    const users = await db.select().from(winnersTable).where(eq(winnersTable.userID, id));
    if (users.length !== 1) return null;
    return users[0]
  }

  static async incrementWins(id: string) {
    await db.transaction(async (tx) => {
      const users = await tx.select().from(winnersTable).where(eq(winnersTable.userID, id));
      const user = users.length === 1 ? users[0] : null
      if (user === null) {
        await tx.insert(winnersTable).values({ userID: id, wins: 1 });
      } else {
        await tx.update(winnersTable).set({ wins: user.wins + 1 }).where(eq(winnersTable.userID, user.userID))
      }
    })
  }
}
