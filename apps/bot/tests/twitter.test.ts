/// <reference types="bun" />
import { expect, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

const { formatTweet, formatTweetSearch, mentionsTwitter, tweetIdsFromText } = await import('../src/modules/twitter');

test('finds tweet ids in x, twitter and fix-up links once each', () => {
	expect(
		tweetIdsFromText(
			'lol https://x.com/someone/status/1234567890123 and https://twitter.com/i/web/status/987654321 again https://fxtwitter.com/someone/status/1234567890123?s=20'
		)
	).toEqual(['1234567890123', '987654321']);
	expect(tweetIdsFromText('https://x.com/jack/status/20')).toEqual(['20']);
	expect(tweetIdsFromText('https://x.com/someone and https://example.com/status/123456')).toEqual([]);
});

test('only offers twitter search when twitter or X comes up', () => {
	expect(mentionsTwitter("what's twitter saying about the new patch")).toBe(true);
	expect(mentionsTwitter('anyone tweeting about this?')).toBe(true);
	expect(mentionsTwitter('what time is it')).toBe(false);
	expect(mentionsTwitter('xbox is down')).toBe(false);
});

test('formats tweets with quotes, retweets and tombstones', () => {
	const quoted = { id: '2', text: 'original take', user: { name: 'B', username: 'b' } };
	expect(
		formatTweet({
			id: '1',
			text: 'agree',
			created_at: 'Mon Jan 01 00:00:00 +0000 2025',
			user: { name: 'A', username: 'a' },
			stats: { likes: 3, retweets: 1 },
			media: [{ type: 'photo' }],
			quoting: quoted,
		})
	).toBe('A (@a) on 2025-01-01: "agree" [photo attached] (3 likes, 1 retweets) quoting B (@b): "original take"');
	expect(formatTweet({ id: '3', user: { username: 'c' }, retweeting: quoted })).toBe(
		'@c retweeted B (@b): "original take"'
	);
	expect(formatTweet({ id: '4', tombstone: true, text: 'This post was deleted' })).toBe(
		'[unavailable: This post was deleted]'
	);
	expect(formatTweet({ id: '5', text: 'cats &amp; dogs &lt;3' })).toBe('unknown: "cats & dogs <3"');
	expect(formatTweetSearch('cats', [])).toBe('No tweets found for "cats".');
});
