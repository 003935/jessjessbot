import { ChannelType, type Client } from 'discord.js';
import { db } from '@/db';
import { fetchTweets, TWEET_USERNAME } from './tweet-fetch';
import { londonClock, randomMinute } from './tweet-clock';

const REFRESH_TIMEOUT_MS = 60_000;
const TICK_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
		}),
	]).finally(() => clearTimeout(timer));
}

export function startDailyTweets(client: Client) {
	if (process.env.DAILY_TWEETS_ENABLED !== 'true') return async () => {};
	let running: Promise<void> | undefined;
	let refreshDay = '';

	async function tick() {
		const clock = londonClock(new Date());
		if (refreshDay !== clock.day) {
			refreshDay = clock.day;
			if (process.env.X_AUTH_TOKEN) {
				try {
					const saved = await withTimeout(fetchTweets(1), REFRESH_TIMEOUT_MS, 'X refresh');
					console.info(`[Tweets] Saved/refreshed ${saved} tweets`);
				} catch (error) {
					console.error(
						'[Tweets] X refresh failed; check credentials/access. Using saved tweets.',
						error
					);
				}
			}
		}
		const guildId = process.env.GUILD_ID;
		if (!guildId) throw new Error('Daily tweets require GUILD_ID');
		const guild = await client.guilds.fetch(guildId);
		const channels = await guild.channels.fetch();
		const matches = channels.filter(
			(c) =>
				c?.type === ChannelType.GuildText &&
				(process.env.GENERAL_CHANNEL_ID
					? c.id === process.env.GENERAL_CHANNEL_ID
					: c.name === 'general')
		);
		if (matches.size !== 1) throw new Error('Set GENERAL_CHANNEL_ID to one general text channel');
		const channel = matches.first()!;
		if (channel.type !== ChannelType.GuildText) return;
		const where = { channelId_day: { channelId: channel.id, day: clock.day } };
		const schedule = await db._db.dailyTweetPost.upsert({
			where,
			create: { ...where.channelId_day, minute: randomMinute(clock.minute) },
			update: {},
		});
		if (schedule.claimedAt || clock.minute < schedule.minute) return;
		let candidates = await db._db.savedTweet.findMany({
			where: { username: TWEET_USERNAME, lastPostedAt: null },
			select: { id: true },
		});
		if (!candidates.length)
			candidates = await db._db.savedTweet.findMany({
				where: { username: TWEET_USERNAME },
				select: { id: true },
			});
		if (!candidates.length) return;
		const tweet = candidates[Math.floor(Math.random() * candidates.length)]!;
		// Atomic claim across restarts/replicas. An ambiguous Discord send is never replayed.
		const claimed = await db._db.dailyTweetPost.updateMany({
			where: { ...where.channelId_day, claimedAt: null },
			data: { claimedAt: new Date(), tweetId: tweet.id },
		});
		if (!claimed.count) return;
		const message = await channel.send({
			content: `https://x.com/${TWEET_USERNAME}/status/${tweet.id}`,
			allowedMentions: { parse: [] },
		});
		await db._db.$transaction([
			db._db.dailyTweetPost.update({ where, data: { messageId: message.id } }),
			db._db.savedTweet.update({ where: { id: tweet.id }, data: { lastPostedAt: new Date() } }),
		]);
	}
	const run = () => {
		if (running) return;
		// The timeout only frees the worker slot; a claimed send is still never replayed.
		running = withTimeout(tick(), TICK_TIMEOUT_MS, 'Daily tweet tick')
			.catch((error) =>
				console.error(
					'[Tweets] Daily worker failed; check database, channel, and Discord permissions. A claimed send will not be retried.',
					error
				)
			)
			.finally(() => {
				running = undefined;
			});
	};
	const timer = setInterval(run, 60_000);
	run();
	return async () => {
		clearInterval(timer);
		await running;
	};
}
