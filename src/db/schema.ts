import { int, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const winnersTable = sqliteTable("winners_Table", {
  date: integer({ mode: 'timestamp' }),
  userID: text(),
}, 
(table) => [
  primaryKey({ columns: [table.date, table.userID] }),
  
]);