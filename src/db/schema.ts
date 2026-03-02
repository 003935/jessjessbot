import { int, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users_table", {
  date: integer({ mode: 'timestamp' }),
  userID: integer(),
}, 
(table) => [
  primaryKey({ columns: [table.date, table.userID] }),
  
]);