import { db } from '@/db';
import { pauseBetweenTweetPages } from './tweet-delay';

export const TWEET_USERNAME = 'kadeem1111';

export async function fetchTweets(maxPages = Infinity) {
	const token = process.env.X_AUTH_TOKEN;
	if (!token) throw new Error('Set X_AUTH_TOKEN in apps/bot/.env');
	const { default: Emusks } = await import('emusks');
	const client = new Emusks();
	let saved = 0;
	try {
		await client.login(token);
		const user = await client.users.getByUsername(TWEET_USERNAME);
		if (!user.id || user.protected) throw new Error('Public X profile unavailable');
		let cursor: string | undefined;
		const cursors = new Set<string>();
		// Follow the timeline to its end without a page cap.
		let pages = 0;
		while (pages < maxPages) {
			const result = await client.users.tweets(user.id, { count: 20, cursor });
			pages++;
			for (const tweet of result.tweets) {
				if (tweet.user?.id !== user.id || tweet.retweeting || tweet.in_reply_to_status_id) continue;
				const publishedAt = new Date(tweet.created_at);
				if (!/^\d+$/.test(tweet.id) || !tweet.text || !Number.isFinite(+publishedAt)) continue;
				await db._db.savedTweet.upsert({
					where: { id: tweet.id },
					create: { id: tweet.id, username: TWEET_USERNAME, text: tweet.text, publishedAt },
					update: { text: tweet.text },
				});
				saved++;
			}
			// Preserve usable partial results, but do not silently report full success.
			if (result.raw?.errors?.length) throw new Error('X returned partial GraphQL errors');
			if (!result.tweets.length || !result.nextCursor || cursors.has(result.nextCursor)) break;
			cursor = result.nextCursor;
			cursors.add(cursor);
			await pauseBetweenTweetPages();
		}
		return saved;
	} finally {
		await Emusks.close();
	}
}

if (import.meta.main) {
	try {
		console.log(`Saved/refreshed ${await fetchTweets()} tweets from @${TWEET_USERNAME}`);
	} catch {
		console.error('Tweet fetch failed. Check X_AUTH_TOKEN, X access, and database migrations.');
		process.exitCode = 1;
	} finally {
		await db.disconnect();
	}
}
