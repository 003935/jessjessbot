import { DatabaseConnection } from './connection';
import {
	GamesTable,
	EventsTable,
	LeagueTable,
	WordleTable,
	GameRolesTable,
	WordleImportTable,
	FailedMentionsTable,
} from './tables';

export class Database extends DatabaseConnection {
	readonly events: EventsTable;
	readonly league: LeagueTable;
	readonly wordle: WordleTable;
	readonly games: GamesTable;
	readonly game_roles: GameRolesTable;
	readonly wordleImport: WordleImportTable;
	readonly failedMentions: FailedMentionsTable;

	constructor(db_url: string) {
		super(db_url);
		this.events = new EventsTable(this);
		this.league = new LeagueTable(this);
		this.wordle = new WordleTable(this);
		this.games = new GamesTable(this);
		this.game_roles = new GameRolesTable(this);
		this.wordleImport = new WordleImportTable(this);
		this.failedMentions = new FailedMentionsTable(this);
	}
}
