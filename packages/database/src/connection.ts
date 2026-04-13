import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export class DatabaseConnection {
	readonly _db: PrismaClient;

	constructor(db_url: string);
	constructor(db_connection: DatabaseConnection);
	constructor(arg: string | DatabaseConnection) {
		if (typeof arg === 'string') {
			const adapter = new PrismaPg({ connectionString: arg });
			const prisma = new PrismaClient({ adapter });
			this._db = prisma;
		} else {
			this._db = arg._db;
		}
	}
}
