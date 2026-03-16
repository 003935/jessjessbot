import { jsonb, pgTable, primaryKey, text, timestamp, varchar, pgEnum, integer } from "drizzle-orm/pg-core";
import { Regions, Tiers } from "twisted/dist/constants";


export const winnersTable = pgTable("winners_Table", {
  discordId: varchar({ length: 20 }).notNull(),
  messageId: varchar({ length: 20 }).notNull()
}, (table) => [
  primaryKey({ columns: [table.discordId, table.messageId] }),
]);

export const regionEnum = pgEnum('region', Object.values(Regions) as [string, ...string[]]);

export const leagueTable = pgTable("league_Table", {
  discordId: varchar({ length: 20 }).notNull(),
  riot_puuid: varchar({ length: 78 }).notNull(),
  riot_gamename: text(),
  riot_tagline: text(),
  region: regionEnum(),
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

export const eventsTable = pgTable("events_Table", {
  channelId: varchar({ length: 20 }).notNull(),
  messageId: varchar({ length: 20 }).notNull(),
  scheduledTime: integer().notNull()
}, (table) => [
  primaryKey({ columns: [table.messageId] }),
]);