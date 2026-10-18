import { DatabaseConnection } from '../connection';
import { Prisma, type ServerConfig } from '../generated/prisma/client';

type ConfigOptions = Omit<ServerConfig, 'guildId'>;

const DEFAULT_CONFIG: ConfigOptions = {
	custom_channel: null,
	bot_disabled_channels: [],
	bot_mention_only_channels: [],
	bot_reply_policy_configured: false,
	bot_ignored_channels: [],
	bot_personality: null,
	bot_likes: [],
	bot_dislikes: [],
	bot_lore: null,
	bot_greeting_lines: [],
	bot_annoyed_lines: [],
	bot_lazy_lines: [],
	bot_fallback_reply: null,
	bot_down_lines: null,
	bot_meme_enabled: true,
	bot_meme_prompt: null,
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
		// Prisma JSON columns are cleared with DbNull, not a plain null.
		const { bot_down_lines, ...rest } = config;
		const data = {
			...rest,
			...(bot_down_lines === undefined
				? {}
				: { bot_down_lines: bot_down_lines === null ? Prisma.DbNull : (bot_down_lines as Prisma.InputJsonValue) }),
		};
		await this._db.serverConfig.upsert({
			create: {
				...data,
				guildId,
			},
			update: data,
			where: {
				guildId,
			},
		});
	}
}
