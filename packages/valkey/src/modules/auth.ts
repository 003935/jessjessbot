import type { RedisClient } from 'bun';

interface BetterAuthSecondaryStorage {
	get: (key: string) => Promise<any>;
	set: (key: string, value: string, ttl: number | undefined) => Promise<void>;
	delete: (key: string) => Promise<void>;
}

class ValkeyAuthModule implements BetterAuthSecondaryStorage {
	private readonly prefix: string;
	private readonly client: RedisClient;

	constructor(prefix: string, client: RedisClient) {
		this.prefix = prefix;
		this.client = client;
	}

	async get(key: string): Promise<any> {
		return await this.client.get(this.prefix + key);
	}

	async set(key: string, value: string, ttl: number | undefined): Promise<void> {
		if (ttl) await this.client.setex(this.prefix + key, ttl, value);
		else await this.client.set(this.prefix + key, value);
	}

	async delete(key: string): Promise<void> {
		await this.client.del(this.prefix + key);
	}
}

export { ValkeyAuthModule };
