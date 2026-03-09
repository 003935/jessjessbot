import { integer, primaryKey, sqliteTable, text, blob } from "drizzle-orm/sqlite-core";
import { Regions, Tiers } from "twisted/dist/constants";


export const winnersTable = sqliteTable("winners_Table", {
  userID: text().notNull(),
  message_timestamp: integer({ mode: 'timestamp' }).notNull()
}, (table) => [
  primaryKey({ columns: [table.userID, table.message_timestamp] }),
]);

export const leagueTable = sqliteTable("league_Table", {
  discordID: text().notNull(),
  riot_puuid: text().notNull(),
  riot_gamename: text(),
  riot_tagline: text(),
  region: text({ enum: Object.values(Regions) as [string, ...string[]] }).notNull(),
  leaguedata: blob({ mode: 'json' }).$type<{
    soloq?: {
      wins: number
      rank: string
      tier: Tiers
      lp: number
    }
  }>(),
  tftdata: blob({ mode: 'json' }).$type<{
    soloq?: {
      wins: number
      rank: string
      tier: string
      lp: number
    }
  }>(),
}, (table) => [
  primaryKey({ columns: [table.discordID, table.riot_puuid] }),
]);
