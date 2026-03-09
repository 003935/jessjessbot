import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const winnersTable = sqliteTable("winners_Table", {
  userID: text().notNull(),
  message_timestamp: integer({ mode: 'timestamp' }).notNull()
}, (table) => [
  primaryKey({ columns: [table.userID, table.message_timestamp] }),
]);
