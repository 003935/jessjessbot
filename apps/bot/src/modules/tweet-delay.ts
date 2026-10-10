import { setTimeout } from 'node:timers/promises';

// Pace pagination; this does not override X's rate limits.
export async function pauseBetweenTweetPages() {
	await setTimeout(15_000 + Math.floor(Math.random() * 15_001));
}
