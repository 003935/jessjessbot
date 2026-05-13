import { RedisClient, type RedisOptions } from 'bun';
import { ValkeyAuthModule, ValkeyDiscordApiModule } from './modules';

class ValkeyClient extends RedisClient {
	public readonly authModule: ValkeyAuthModule;
	public readonly discordModule: ValkeyDiscordApiModule;

	constructor(url?: string, options?: RedisOptions) {
		super(url, options);
		this.authModule = new ValkeyAuthModule('auth:', this);
		this.discordModule = new ValkeyDiscordApiModule('discord:', this);
	}
}

export default ValkeyClient;
export * from './modules';
