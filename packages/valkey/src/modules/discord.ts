import type { RedisClient } from 'bun';
import type {
	APIApplicationEmoji,
	APIGuild,
	APIGuildMember,
	APIUser,
	RESTGetAPIGuildMembersSearchResult,
	RESTGetAPICurrentUserGuildsResult,
	RESTAPIPartialCurrentUserGuild,
} from 'discord-api-types/v10';

const TTLConfig = {
	guildMember: 1000 * 60 * 10, // 10 minutes
	user: 1000 * 60 * 10, // 10 minutes

	guild: 1000 * 60 * 10, // 10 minutes
	user_guilds: 1000 * 60 * 10, // 10 minutes

	emojis: 1000 * 60 * 60, // 1 hour
};

class ValkeyDiscordApiSubModule<T extends object, K> {
	constructor(
		private readonly prefix: string,
		private readonly module: ValkeyDiscordApiModule,
		private readonly serialize: (key: K) => string,
		private readonly ttl: number
	) {}

	async get(key: K): Promise<T | null> {
		const v = await this.module.get(this.prefix + this.serialize(key));
		if (v) return JSON.parse(v);
		return null;
	}

	async set(key: K, value: T, overrideTTL?: number): Promise<void> {
		await this.module.set(this.prefix + this.serialize(key), value, overrideTTL ?? this.ttl);
	}

	async delete(key: K): Promise<void> {
		await this.module.delete(this.prefix + this.serialize(key));
	}
}

class ValkeyDiscordApiModule {
	private readonly prefix: string;
	private readonly client: RedisClient;

	public readonly emojis: ValkeyDiscordApiSubModule<APIApplicationEmoji[], string>;
	public readonly guild: ValkeyDiscordApiSubModule<APIGuild, string>;
	public readonly guildMember: ValkeyDiscordApiSubModule<
		APIGuildMember,
		{ guildID: string; userID: string }
	>;
	public readonly user: ValkeyDiscordApiSubModule<APIUser, string>;
	public readonly user_guilds: ValkeyDiscordApiSubModule<RESTAPIPartialCurrentUserGuild[], string>;

	constructor(prefix: string, client: RedisClient) {
		this.prefix = prefix;
		this.client = client;

		this.emojis = this.initSub('emojis:', (id) => id, TTLConfig.emojis);
		this.guild = this.initSub('guild:', (id) => id, TTLConfig.guild);
		this.guildMember = this.initSub(
			'guildMember:',
			(k) => `${k.guildID}:${k.userID}`,
			TTLConfig.guildMember
		);
		this.user = this.initSub('user:', (id) => id, TTLConfig.user);
		this.user_guilds = this.initSub('user_guilds:', (k) => k, TTLConfig.user_guilds);
	}

	private initSub<T extends object, K>(prefix: string, serialize: (key: K) => string, ttl: number) {
		return new ValkeyDiscordApiSubModule<T, K>(prefix, this, serialize, ttl);
	}

	async get(key: string): Promise<string | null> {
		return await this.client.get(this.prefix + key);
	}

	async set(key: string, value: string | object, ttl?: number): Promise<void> {
		const v = typeof value === 'object' ? JSON.stringify(value) : value;
		if (ttl) await this.client.setex(this.prefix + key, ttl, v);
		else await this.client.set(this.prefix + key, v);
	}

	async delete(key: string): Promise<void> {
		await this.client.del(this.prefix + key);
	}
}

export { ValkeyDiscordApiModule, ValkeyDiscordApiSubModule as ValkeyDiscordApiSubModule };
