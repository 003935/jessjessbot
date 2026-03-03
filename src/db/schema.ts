import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const winnersTable = sqliteTable("winners_Table", {
  userID: text().primaryKey(),
  wins: integer().notNull(),
});
