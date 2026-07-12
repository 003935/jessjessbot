import { REST } from '@discordjs/rest';
import { ValkeyDiscordApiModule } from '@repo/valkey';
import {
	Routes,
	type RESTGetCurrentApplicationResult,
	type RESTGetAPIApplicationEmojisResult,
	type APIApplicationEmoji,
	type APIApplication,
	type RESTGetAPIGuildResult,
	type APIGuild,
	type APIGuildMember,
	type RESTGetAPIGuildMemberResult,
	type RESTGetAPICurrentUserGuildsResult,
	type RESTAPIPartialCurrentUserGuild,
	type APIUser,
	type RESTGetAPIUserResult,
	type RESTGetAPIGuildMembersSearchResult,
	RESTGetAPIGuildChannelsResult,
} from 'discord-api-types/v10';

class DiscordApi {
	private readonly api: REST;
	private readonly application: APIApplication;

	private readonly cache: ValkeyDiscordApiModule;

	constructor(api: REST, application: APIApplication, cache: ValkeyDiscordApiModule) {
		this.api = api;
		this.application = application;
		this.cache = cache;
	}

	static async fromToken(token: string, module: ValkeyDiscordApiModule) {
		const api = new REST({
			version: '10',
		}).setToken(token);
		const application = (await api.get(
			Routes.currentApplication()
		)) as RESTGetCurrentApplicationResult;
		return new DiscordApi(api, application, module);
	}

	async getEmojis(): Promise<APIApplicationEmoji[]> {
		const cached = await this.cache.emojis.get(this.application.id);
		if (cached) return cached;

		const fetched = (
			(await this.api.get(
				Routes.applicationEmojis(this.application.id)
			)) as RESTGetAPIApplicationEmojisResult
		).items;
		await this.cache.emojis.set(this.application.id, fetched);
		return fetched;
	}

	async getGuild(guildId: string): Promise<APIGuild> {
		const cached = await this.cache.guild.get(guildId);
		if (cached) return cached;

		const fetched = (await this.api.get(Routes.guild(guildId))) as RESTGetAPIGuildResult;
		await this.cache.guild.set(guildId, fetched);
		return fetched;
	}

	async getGuildMember(guildId: string, userId: string): Promise<APIGuildMember> {
		const cached = await this.cache.guildMember.get({ guildID: guildId, userID: userId });
		if (cached) return cached;

		const fetched = (await this.api.get(
			Routes.guildMember(guildId, userId)
		)) as RESTGetAPIGuildMemberResult;
		await this.cache.guildMember.set({ guildID: guildId, userID: userId }, fetched);
		return fetched;
	}

	async getUser(userId: string): Promise<APIUser> {
		const cached = await this.cache.user.get(userId);
		if (cached) return cached;

		const fetched = (await this.api.get(Routes.user(userId))) as RESTGetAPIUserResult;
		await this.cache.user.set(userId, fetched);
		return fetched;
	}

	private async fetchSearchGuildMembers(guildId: string, query: string) {
		const params = new URLSearchParams();
		params.set('query', query);
		params.set('limit', '25');
		return (await this.api.get(
			`${Routes.guildMembersSearch(guildId)}?${params.toString()}`
		)) as RESTGetAPIGuildMembersSearchResult;
	}

	async searchGuildMembers(guildId: string, query: string) {
		return await this.fetchSearchGuildMembers(guildId, query);
	}

	async getBotGuilds(): Promise<RESTAPIPartialCurrentUserGuild[]> {
		const botId = this.application.bot?.id;
		if (!botId) throw new Error('Bot ID not found');

		const cached = await this.cache.user_guilds.get(botId);
		if (cached) return cached;

		const fetched = (await this.api.get(Routes.userGuilds())) as RESTGetAPICurrentUserGuildsResult;
		await this.cache.user_guilds.set(botId, fetched, 1000 * 60);
		return fetched;
	}

	private async fetchUserGuilds(accessToken: string): Promise<RESTAPIPartialCurrentUserGuild[]> {
		const api = new REST({
			version: '10',
			authPrefix: 'Bearer',
		}).setToken(accessToken);
		const result = (await api.get(Routes.userGuilds())) as RESTGetAPICurrentUserGuildsResult;
		return result;
	}

	async getUserGuilds(userId: string, accessToken: string) {
		const cached = await this.cache.user_guilds.get(userId);
		if (cached) return cached;

		const fetched = await this.fetchUserGuilds(accessToken);
		await this.cache.user_guilds.set(userId, fetched);
		return fetched;
	}

	async getGuildChannels(guildId: string) {
		const res = (await await this.api.get(
			Routes.guildChannels(guildId)
		)) as RESTGetAPIGuildChannelsResult;

		return res;
	}

	async reactToMessage(channelId: string, messageID: string, emojiId: string) {
		await this.api.put(Routes.channelMessageOwnReaction(channelId, messageID, emojiId));
	}

	async sendCustomMessage(
		channelId: string,
		content: {
			roleId?: string;
			emojiId?: string;
			gameName: string;
			time: string;
			name?: string;
		}
	) {
		let emoji: APIApplicationEmoji | undefined;
		if (content.emojiId) {
			const emojis = await this.getEmojis(); // FIXME change to single fetch?
			emoji = emojis.find((e) => e.id === content.emojiId);
		}

		const text_components = [
			{
				type: 10,
				content: `# ${content.name ?? content.gameName} ${content.roleId ? `<@&${content.roleId}>` : ''}`,
			},
			{
				type: 10,
				content: `React with ✅ to sign up!`,
			},
		];

		const ret = await this.api.post(Routes.channelMessages(channelId), {
			body: {
				components: [
					{
						type: 17,
						accent_color: null,
						spoiler: false,
						components: emoji
							? [
									{
										type: 9,
										components: text_components,
										accessory: {
											type: 11,
											media: {
												url: `https://cdn.discordapp.com/emojis/${emoji.id}.webp?animated=${emoji.animated}`,
											},
										},
									},
								]
							: text_components,
					},
				],
				flags: 32768,
			},
		});
		return (ret as { id: string }).id;
	}
}

export * from './utils';

export { DiscordApi };
