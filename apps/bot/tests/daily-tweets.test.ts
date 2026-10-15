/// <reference types="bun" />
import { beforeEach, expect, mock, test } from 'bun:test';
import type { Client } from 'discord.js';

let claimed = false;
let sends = 0;
let failSend = false;
let empty = false;
let posted = false;
mock.module('../src/db', () => ({
	db: {
		_db: {
			dailyTweetPost: {
				upsert: async () => ({ minute: 0, claimedAt: claimed ? new Date() : null }),
				updateMany: async () => {
					if (claimed) return { count: 0 };
					claimed = true;
					return { count: 1 };
				},
				update: async () => ({}),
			},
			savedTweet: {
				findMany: async () => (empty ? [] : [{ id: '123456789' }]),
				update: async () => {
					posted = true;
				},
			},
			$transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
		},
	},
}));
mock.module('../src/modules/tweet-fetch', () => ({
	TWEET_USERNAME: 'kadeem1111',
	fetchTweets: async () => 0,
}));
const { startDailyTweets } = await import('../src/modules/daily-tweets');
const { Collection, ChannelType } = await import('discord.js');
const client = {
	guilds: {
		fetch: async () => ({
			channels: {
				fetch: async () =>
					new Collection([
						[
							'general-id',
							{
								id: 'general-id',
								name: 'general',
								type: ChannelType.GuildText,
								send: async (payload: { content: string; allowedMentions: unknown }) => {
									sends++;
									expect(payload.content).toBe('https://x.com/kadeem1111/status/123456789');
									expect(payload.allowedMentions).toEqual({ parse: [] });
									if (failSend) throw new Error('Connection lost after send');
									return { id: 'message-id' };
								},
							},
						],
					]),
			},
		}),
	},
} as unknown as Client;

beforeEach(() => {
	claimed = false;
	sends = 0;
	failSend = false;
	empty = false;
	posted = false;
	process.env.DAILY_TWEETS_ENABLED = 'true';
	process.env.GUILD_ID = 'guild-id';
	delete process.env.GENERAL_CHANNEL_ID;
	delete process.env.X_AUTH_TOKEN;
});

test('two workers and a restart produce only one daily message', async () => {
	await Promise.all([startDailyTweets(client)(), startDailyTweets(client)()]);
	await startDailyTweets(client)();
	expect(sends).toBe(1);
	expect(posted).toBe(true);
});
test('an ambiguous send is not replayed after restart', async () => {
	failSend = true;
	await startDailyTweets(client)();
	failSend = false;
	await startDailyTweets(client)();
	expect(sends).toBe(1);
	expect(posted).toBe(false);
});
test('empty collection does not consume the daily send', async () => {
	empty = true;
	await startDailyTweets(client)();
	expect(claimed).toBe(false);
	empty = false;
	await startDailyTweets(client)();
	expect(sends).toBe(1);
});
