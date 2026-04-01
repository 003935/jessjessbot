import {
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	varchar,
	pgEnum,
	serial,
	uniqueIndex,
	boolean,
	integer,
} from 'drizzle-orm/pg-core';
import { Regions, Tiers } from 'twisted/dist/constants';

export const scoreEnum = pgEnum('score', ['1', '2', '3', '4', '5', '6', 'DNF']);

export const winnersTable = pgTable(
	'winners_Table',
	{
		message_timestamp: timestamp().notNull(),
		channelId: varchar({ length: 20 }).notNull(),
		messageId: varchar({ length: 20 }).notNull(),
		discordId: varchar({ length: 20 }).notNull(),
		score: scoreEnum().notNull(),
		winner: boolean().notNull(),
	},
	(table) => [primaryKey({ columns: [table.discordId, table.channelId, table.messageId] })]
);

export const regionEnum = pgEnum('region', Object.values(Regions) as [string, ...string[]]);

export const leagueTable = pgTable('league_Table', {
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

export const eventsTable = pgTable('events_Table', {
	id: serial().primaryKey(),
	guildId: varchar({ length: 20 }).notNull(),
	channelId: varchar({ length: 20 }).notNull(),
	messageId: varchar({ length: 20 }).notNull(),
	scheduledTime: timestamp().notNull(),
	gameName: text()
		.notNull()
		.references(() => eventGameTable.name, { onDelete: 'cascade', onUpdate: 'cascade' }),
});

export const eventGameTable = pgTable('event_Game_Table', {
	name: text().primaryKey(),
	icon: text(),
});

export const gameRoleTable = pgTable(
	'game_Role_Table',
	{
		guildId: varchar({ length: 20 }).notNull(),
		gameName: text()
			.notNull()
			.references(() => eventGameTable.name, { onDelete: 'cascade', onUpdate: 'cascade' }),
		roleId: varchar({ length: 20 }).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.guildId, table.roleId] }),
		uniqueIndex('game_role_table_guild_id_game_name_idx').on(table.guildId, table.gameName),
	]
);

export const wordleImportTable = pgTable(
	'wordle_import_Table',
	{
		guildId: varchar({ length: 20 }).notNull(),
		lastImport: timestamp().notNull(),
		importedBy: varchar({ length: 20 }).notNull(),
		messagesImported: integer().notNull(),
	},
	(table) => [primaryKey({ columns: [table.guildId] }), uniqueIndex('wordle_import_table_guild_id_idx').on(table.guildId)]
);
