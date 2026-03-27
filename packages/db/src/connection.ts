import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DatabaseType = PostgresJsDatabase<typeof schema> & {
  $client: postgres.Sql<{}>;
}

export class DatabaseConnection {
  readonly _db: DatabaseType

  constructor(db_url: string)
  constructor(db_connection: DatabaseConnection)
  constructor(arg: string | DatabaseConnection) {
    if (typeof arg === 'string') {
      const client = postgres(arg);
      this._db = drizzle(client, { schema });
    } else {
      this._db = arg._db;
    }
  }
}
