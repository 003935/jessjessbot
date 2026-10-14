import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HallTable } from '../src/tables/hall';

test('general Hall rankings omit jjb and signup posts, but direct jjb lookup includes its messages', async () => {
	const queries: Record<string, unknown>[] = [];
	const hall = Object.create(HallTable.prototype) as HallTable;
	Object.defineProperty(hall, '_db', {
		value: {
			custom: {
				findMany: async () => [{ messageId: 'signup-post' }],
			},
			hallMessage: {
				findMany: async (query: Record<string, unknown>) => {
					queries.push(query);
					return [];
				},
			},
		},
	});

	await hall.getTopMessages('guild', ['channel'], 'jjb');
	await hall.getTopMessages('guild', ['channel'], 'jjb', 'jjb', new Date('2026-10-01'));

	assert.deepEqual(queries[0]?.where, {
		guildId: 'guild',
		channelId: { in: ['channel'] },
		messageId: { notIn: ['signup-post'] },
		authorId: { not: 'jjb' },
	});
	assert.deepEqual(queries[1]?.where, {
		guildId: 'guild',
		channelId: { in: ['channel'] },
		messageId: { notIn: ['signup-post'] },
		authorId: 'jjb',
		createdAt: { gte: new Date('2026-10-01') },
	});
});
