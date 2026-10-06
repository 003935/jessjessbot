import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankFavorites } from '../src/modules/favorite-ranking.ts';

test('favourite ranking uses warmth, interactions, and current conversation', () => {
	const candidates = [
		{ userId: 'quiet', score: 0, interactionCount: 1 },
		{ userId: 'chatty', score: 0, interactionCount: 32 },
		{ userId: 'warm', score: 2, interactionCount: 3 },
	];
	assert.equal(rankFavorites(candidates, new Set(), 'quiet')[0]?.userId, 'warm');
	assert.equal(rankFavorites(candidates.slice(0, 2), new Set(), 'quiet')[0]?.userId, 'chatty');
	assert.equal(rankFavorites([
		{ userId: 'recent', score: 0, interactionCount: 4 },
		{ userId: 'old', score: 0, interactionCount: 4 },
	], new Set(['recent']), 'old')[0]?.userId, 'recent');
});
