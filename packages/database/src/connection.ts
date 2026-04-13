import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export interface PoolConfig {
	max?: number;
	idleTimeoutMillis?: number;
	connectionTimeoutMillis?: number;
	maxUses?: number;
}

const DEFAULT_POOL_CONFIG: PoolConfig = {
	max: 5,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 5000,
	maxUses: 7500,
};

export interface DatabaseLogger {
	error(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
}

const DEFAULT_LOGGER: DatabaseLogger = {
	error: (msg, ...args) => console.error(msg, ...args),
	warn: (msg, ...args) => console.warn(msg, ...args),
	info: (msg, ...args) => console.info(msg, ...args),
};

export class DatabaseConnection {
	readonly _db: PrismaClient;
	private _pool: Pool | null = null;
	private _logger: DatabaseLogger;
	private _ownsResources: boolean;

	constructor(db_url: string, poolConfig?: PoolConfig, logger?: DatabaseLogger);
	constructor(db_connection: DatabaseConnection);
	constructor(arg: string | DatabaseConnection, poolConfig?: PoolConfig, logger?: DatabaseLogger) {
		this._logger = logger ?? DEFAULT_LOGGER;

		if (typeof arg === 'string') {
			const config = { ...DEFAULT_POOL_CONFIG, ...poolConfig };
			const pool = new Pool({
				connectionString: arg,
				max: config.max,
				idleTimeoutMillis: config.idleTimeoutMillis,
				connectionTimeoutMillis: config.connectionTimeoutMillis,
				maxUses: config.maxUses,
			});
			this._pool = pool;

			pool.on('error', (err) => {
				this._logger.error('[Database] Pool error:', err.message);
			});

			const adapter = new PrismaPg(pool, {
				onPoolError: (err) => {
					this._logger.error('[Database] Adapter pool error:', err.message);
				},
				onConnectionError: (err) => {
					this._logger.error('[Database] Adapter connection error:', err.message);
				},
			});
			const prisma = new PrismaClient({ adapter });
			this._db = prisma;
			this._ownsResources = true;
		} else {
			this._db = arg._db;
			this._ownsResources = false;
		}
	}

	async disconnect(): Promise<void> {
		if (!this._ownsResources) return;
		try {
			await this._db.$disconnect();
		} catch (error) {
			this._logger.error('[Database] Disconnect error:', error);
		}
		if (this._pool) {
			await this._pool.end();
		}
	}
}
