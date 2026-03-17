import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
  pgEnum,
  integer,
  serial,
} from "drizzle-orm/pg-core";
import { Regions, Tiers } from "twisted/dist/constants";

export const winnersTable = pgTable(
  "winners_Table",
  {
    discordId: varchar({ length: 20 }).notNull(),
    messageId: varchar({ length: 20 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.discordId, table.messageId] })],
);

export const regionEnum = pgEnum(
  "region",
  Object.values(Regions) as [string, ...string[]],
);

export const leagueTable = pgTable("league_Table", {
  discordId: varchar({ length: 20 }).notNull(),
  riot_puuid: varchar({ length: 78 }).notNull().primaryKey(),
  riot_gamename: text(),
  riot_tagline: text(),
  region: regionEnum().notNull(),
  leaguedata: jsonb().$type<{
    soloq?: {
      wins: number;
      rank: string;
      tier: Tiers;
      lp: number;
    };
  }>(),
  tftdata: jsonb().$type<{
    soloq?: {
      wins: number;
      rank: string;
      tier: Tiers;
      lp: number;
    };
  }>(),
});

export const eventsTable = pgTable("events_Table", {
  id: serial().primaryKey(),
  guildId: varchar({ length: 20 }).notNull(),
  channelId: varchar({ length: 20 }).notNull(),
  messageId: varchar({ length: 20 }).notNull(),
  scheduledTime: timestamp().notNull(),
  game: text().notNull(),
});

export const eventsGameTable = pgTable(
  "events_Games_Table",
  {
    guildId: varchar({ length: 20 }).notNull(),
    name: text().notNull(),
    roleId: varchar({ length: 20 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.roleId] })],
);
