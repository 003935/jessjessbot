import { DatabaseConnection } from './connection';
import { EventGameTable, EventsTable, LeagueTable, WordleTable } from './tables';

export class Database extends DatabaseConnection {
	readonly event_table: EventsTable;
	readonly league_table: LeagueTable;
	readonly wordle_table: WordleTable;
	readonly event_game_table: EventGameTable;

	constructor(db_url: string) {
		super(db_url);
		this.event_table = new EventsTable(this);
		this.league_table = new LeagueTable(this);
		this.wordle_table = new WordleTable(this);
		this.event_game_table = new EventGameTable(this);
	}
}
