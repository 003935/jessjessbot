import { rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pauseBetweenTweetPages } from './tweet-delay';
import { db } from '@/db';

const path = resolve(import.meta.dir, '../../../../skill-output/kadeem1111-tweets.json');
const statePath = path.replace('.json', '-cursor.json');
type Tweet = { id: string; username: string; text: string; publishedAt: string };
const tweets = new Map<string, Tweet>();
if (await Bun.file(path).exists()) {
  for (const tweet of await Bun.file(path).json() as Tweet[]) tweets.set(tweet.id, tweet);
}
let cursor: string | undefined;
if (await Bun.file(statePath).exists()) {
  const state = await Bun.file(statePath).json();
  // The replies timeline has its own cursor. Start it at the newest page once;
  // it can expose older originals omitted or truncated on the posts timeline.
  if (state.source === 'replies' && !state.complete) cursor = state.cursor;
}
async function checkpoint(complete: boolean) {
  await Bun.write(path + '.tmp', JSON.stringify([...tweets.values()], null, 2));
  await rename(path + '.tmp', path);
  await Bun.write(statePath + '.tmp', JSON.stringify({ cursor, complete, count: tweets.size, source: 'replies' }));
  await rename(statePath + '.tmp', statePath);
}
const token = process.env.X_AUTH_TOKEN;
if (!token) throw new Error('Set X_AUTH_TOKEN privately in apps/bot/.env');
const { default: Emusks } = await import('emusks');
const client = new Emusks();
let pages = 0;
try {
  await client.login(token);
  const user = await client.users.getByUsername('kadeem1111');
  if (!user.id || user.protected) throw new Error('Public profile unavailable');
  const cursors = new Set<string>();
  if (cursor) cursors.add(cursor);
  while (true) {
    const page = await client.users.replies(user.id, { count: 20, cursor });
    pages++;
    for (const tweet of page.tweets) {
      if (tweet.user?.id !== user.id || tweet.retweeting || tweet.in_reply_to_status_id) continue;
      const date = new Date(tweet.created_at);
      if (!/^\d+$/.test(tweet.id) || !tweet.text || !Number.isFinite(+date)) continue;
      tweets.set(tweet.id, { id: tweet.id, username: 'kadeem1111', text: tweet.text, publishedAt: date.toISOString() });
      await db._db.savedTweet.upsert({
        where: { id: tweet.id },
        create: { id: tweet.id, username: 'kadeem1111', text: tweet.text, publishedAt: date },
        update: { text: tweet.text },
      });
    }
    if (page.raw?.errors?.length) throw new Error('Partial GraphQL response');
    await checkpoint(false);
    const reason = !page.tweets.length ? 'empty page' : !page.nextCursor ? 'end of timeline' : cursors.has(page.nextCursor) ? 'repeated cursor' : null;
    if (reason) {
      await checkpoint(true);
      console.log(JSON.stringify({ saved: tweets.size, pages, stopped: reason }));
      break;
    }
    cursor = page.nextCursor!;
    cursors.add(cursor!);
    await checkpoint(false);
    if (pages % 10 === 0) console.log(JSON.stringify({ saved: tweets.size, pages }));
    await pauseBetweenTweetPages();
  }
} catch (error) {
  await checkpoint(false);
  const failure = error as { status?: number; rateLimit?: { reset?: number } };
  console.error(JSON.stringify({ saved: tweets.size, pages, stopped: 'request failed; progress saved', status: failure.status, reset: failure.rateLimit?.reset }));
  process.exitCode = 1;
} finally {
  await Emusks.close();
  await db.disconnect();
}
