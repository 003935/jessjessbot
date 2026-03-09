import { bigint, jsonb, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { Tiers } from "twisted/dist/constants";


export const winnersTable = pgTable("winners_Table", {
  discordId: varchar({ length: 20 }).notNull(),
  message_timestamp: timestamp().notNull()
}, (table) => [
  primaryKey({ columns: [table.discordId, table.message_timestamp] }),
]);

export const leagueTable = pgTable("league_Table", {
  discordId: varchar({ length: 20 }).notNull(),
  riot_puuid: varchar({ length: 78 }).notNull(),
  riot_gamename: text(),
  riot_tagline: text(),
  leaguedata: jsonb().$type<{
    soloq?: {
      wins: number
      rank: string
      tier: Tiers
      lp: number
    }
  }>(),
  tftdata: jsonb().$type<{
    soloq?: {
      wins: number
      rank: string
      tier: Tiers
      lp: number
    }
  }>(),
}, (table) => [
  primaryKey({ columns: [table.discordId, table.riot_puuid] }),
]);
