import { DatabaseConnection, type DatabaseLogger, type PoolConfig } from './connection';
import * as t from './tables';

export class Database extends DatabaseConnection {
	readonly events: t.EventsTable;
	readonly league: t.LeagueTable;
	readonly wordle: t.WordleTable;
	readonly games: t.GamesTable;
	readonly game_roles: t.GameRolesTable;
	readonly wordleImport: t.WordleImportTable;
	readonly failedMentions: t.FailedMentionsTable;
	readonly config: t.ConfigTable;
	readonly movie: t.MovieTable;

	constructor(db_url: string, poolConfig?: PoolConfig, logger?: DatabaseLogger) {
		super(db_url, poolConfig, logger);
		this.events = new t.EventsTable(this);
		this.league = new t.LeagueTable(this);
		this.wordle = new t.WordleTable(this);
		this.games = new t.GamesTable(this);
		this.game_roles = new t.GameRolesTable(this);
		this.wordleImport = new t.WordleImportTable(this);
		this.failedMentions = new t.FailedMentionsTable(this);
		this.config = new t.ConfigTable(this);
		this.movie = new t.MovieTable(this);
	}
}
