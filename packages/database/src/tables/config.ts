import { DatabaseConnection } from '../connection';
import { type ServerConfig } from '../generated/prisma/client';

type ConfigOptions = Omit<ServerConfig, 'guildId'>;

const DEFAULT_CONFIG: ConfigOptions = {
	custom_channel: null,
};

export class ConfigTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async getConfig(guildId: string): Promise<ServerConfig> {
		const ret = await this._db.serverConfig.findUnique({ where: { guildId } });
		return ret ?? { ...DEFAULT_CONFIG, guildId };
	}

	async setConfig(guildId: string, config: Partial<ConfigOptions>) {
		await this._db.serverConfig.upsert({
			create: {
				...config,
				guildId,
			},
			update: config,
			where: {
				guildId,
			},
		});
	}
}
