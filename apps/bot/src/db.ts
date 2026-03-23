import { Database } from '@repo/database';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not defined');
}

export const db = new Database(process.env.DATABASE_URL);
