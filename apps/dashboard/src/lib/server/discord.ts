import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { AsyncCache, MapAsyncCache } from '$lib/utils';
import { REST } from '@discordjs/rest';
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
} from 'discord-api-types/v10';

class DiscordApi {
	private api: REST;
	private application: APIApplication;
	private emojis: AsyncCache<APIApplicationEmoji[]>;
	private botGuilds: AsyncCache<RESTAPIPartialCurrentUserGuild[]>;

	private guild_map: MapAsyncCache<string, APIGuild>;
	private userGuilds_map: MapAsyncCache<
		{ userId: string; accessToken: string },
		RESTAPIPartialCurrentUserGuild[]
	>;
	private guildMembers_map: MapAsyncCache<
		{
			guildId: string;
			userId: string;
		},
		APIGuildMember
	>;
	private user_map: MapAsyncCache<string, APIUser>;

	constructor(api: REST, application: APIApplication) {
		this.api = api;
		this.application = application;
		this.emojis = new AsyncCache<APIApplicationEmoji[]>(
			1000 * 60 * 60, // 1 hour TTL
			() => this.fetchEmojis()
		);
		this.botGuilds = new AsyncCache<RESTAPIPartialCurrentUserGuild[]>(
			1000 * 60, // 1 min TTL
			() => this.fetchBotGuilds()
		);

		this.guild_map = new MapAsyncCache(
			1000 * 60 * 5, // 5 min TTL
			(guildId) => this.fetchGuild(guildId),
			(guildId) => guildId
		);
		this.guildMembers_map = new MapAsyncCache(
			1000 * 60 * 5, // 5 min TTL
			({ guildId, userId }) => this.fetchGuildMember(guildId, userId),
			({ guildId, userId }) => `${guildId}-${userId}`
		);
		this.userGuilds_map = new MapAsyncCache(
			1000 * 60 * 5, // 5 min TTL
			({ accessToken }) => this.fetchUserGuilds(accessToken),
			({ userId, accessToken }) => `${userId}-${accessToken}`
		);
		this.user_map = new MapAsyncCache(
			1000 * 60 * 5, // 5 min TTL
			(userId) => this.fetchUser(userId),
			(userId) => userId
		);
	}

	private async fetchEmojis() {
		const result = (await this.api.get(
			Routes.applicationEmojis(this.application.id)
		)) as RESTGetAPIApplicationEmojisResult;
		return result.items;
	}

	private async fetchGuild(guildId: string) {
		return (await this.api.get(Routes.guild(guildId))) as RESTGetAPIGuildResult;
	}

	private async fetchGuildMember(guildId: string, userId: string) {
		return (await this.api.get(Routes.guildMember(guildId, userId))) as RESTGetAPIGuildMemberResult;
	}

	private async fetchBotGuilds() {
		return (await this.api.get(Routes.userGuilds())) as RESTGetAPICurrentUserGuildsResult;
	}

	private async fetchUserGuilds(accessToken: string) {
		const api = new REST({
			version: '10',
			authPrefix: 'Bearer',
		}).setToken(accessToken);
		const result = (await api.get(Routes.userGuilds())) as RESTGetAPICurrentUserGuildsResult;
		return result;
	}

	private async fetchUser(userId: string) {
		return (await this.api.get(Routes.user(userId))) as RESTGetAPIUserResult;
	}

	async getEmojis() {
		return await this.emojis.get();
	}

	async getGuild(guildId: string) {
		return await this.guild_map.get(guildId);
	}

	async getGuildMember(guildId: string, userId: string) {
		return await this.guildMembers_map.get({ guildId, userId });
	}

	async getUser(userId: string) {
		return await this.user_map.get(userId);
	}

	async getBotGuilds() {
		return await this.botGuilds.get();
	}

	async getUserGuilds(userId: string, accessToken: string) {
		return await this.userGuilds_map.get({ userId, accessToken });
	}
}

let discordApi: DiscordApi;

if (!building) {
	const api = new REST({
		version: '10',
	}).setToken(env.DISCORD_BOT_TOKEN);
	const application = (await api.get(
		Routes.currentApplication()
	)) as RESTGetCurrentApplicationResult;
	discordApi = new DiscordApi(api, application);
}

export { discordApi };
