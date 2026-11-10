import { describe, expect, test } from 'bun:test';
import type { APIMessage } from 'discord-api-types/v10';
import {
	compactMessage,
	conversationWindows,
	reviewDm,
	reviewSince,
	snowflakeAt,
	snowflakeTime,
	tokenMatches,
} from './server/review';

const BOT = '999';
let next = 1000n;
function message(authorId: string, content = 'hi', extra: Partial<APIMessage> = {}): APIMessage {
	next++;
	return {
		id: next.toString(),
		channel_id: '1',
		author: {
			id: authorId,
			username: `user${authorId}`,
			global_name: null,
			discriminator: '0',
			avatar: null,
		},
		content,
		timestamp: new Date().toISOString(),
		edited_timestamp: null,
		tts: false,
		mention_everyone: false,
		mentions: [],
		mention_roles: [],
		attachments: [],
		embeds: [],
		pinned: false,
		type: 0,
		...extra,
	} as APIMessage;
}

describe('review token', () => {
	test('needs the exact bearer token', () => {
		expect(tokenMatches('secret-token', 'Bearer secret-token')).toBe(true);
		expect(tokenMatches('secret-token', 'Bearer secret-tokem')).toBe(false);
		expect(tokenMatches('secret-token', 'secret-token')).toBe(false);
		expect(tokenMatches('secret-token', null)).toBe(false);
	});

	test('is off when no token is set', () => {
		expect(tokenMatches(undefined, 'Bearer ')).toBe(false);
		expect(tokenMatches('', 'Bearer ')).toBe(false);
	});
});

test('snowflakes round-trip to the millisecond', () => {
	const at = new Date('2026-11-03T12:00:00.000Z');
	expect(snowflakeTime(snowflakeAt(at)).toISOString()).toBe(at.toISOString());
});

test('since defaults to a week ago and never goes past 30 days', () => {
	const now = new Date('2026-11-10T00:00:00Z');
	expect(reviewSince(null, now).toISOString()).toBe('2026-11-03T00:00:00.000Z');
	expect(reviewSince('2026-01-01T00:00:00Z', now).toISOString()).toBe('2026-10-11T00:00:00.000Z');
});

describe('conversation windows', () => {
	test('keeps the chat around jjb and skips chat she was not in', () => {
		const chat = [
			message('1', 'unrelated'),
			message('1', 'unrelated'),
			message('1', 'unrelated'),
			message('2', 'jjb what do u think'),
			message(BOT, 'bold of u to ask'),
			message('2', 'lol'),
			...Array.from({ length: 10 }, () => message('3', 'other stuff')),
			message('4', 'also unrelated'),
		];
		const windows = conversationWindows(chat, BOT, 1, 1);
		expect(windows).toHaveLength(1);
		expect(windows[0]!.map((m) => m.content)).toEqual([
			'unrelated',
			'jjb what do u think',
			'bold of u to ask',
			'lol',
		]);
	});

	test('counts replies to her and mentions, and merges overlapping stretches', () => {
		const hers = message(BOT, 'hello');
		const chat = [
			hers,
			message('1', 'x'),
			message('2', 'reply', { message_reference: { message_id: hers.id, channel_id: '1' } }),
			message('3', 'y'),
			message('3', 'y'),
			message('3', 'y'),
			message('3', 'y'),
			message('5', 'hey', {
				mentions: [
					{ id: BOT, username: 'jjb', global_name: null, discriminator: '0', avatar: null },
				],
			}),
		];
		const windows = conversationWindows(chat, BOT, 0, 0);
		expect(windows.map((w) => w.map((m) => m.content))).toEqual([['hello'], ['reply'], ['hey']]);
		expect(conversationWindows(chat, BOT, 2, 2)).toHaveLength(1);
	});
});

test('compact messages keep names, reactions and replies, and trim long text', () => {
	const compact = compactMessage(
		message('1', 'a'.repeat(700), {
			reactions: [
				{
					emoji: { id: null, name: '😂' },
					count: 3,
					me: false,
					count_details: { burst: 0, normal: 3 },
					burst_colors: [],
					me_burst: false,
				},
			],
			message_reference: { message_id: '42', channel_id: '1' },
		})
	);
	expect(compact.author.name).toBe('user1');
	expect(compact.content.length).toBe(601);
	expect(compact.reactions).toEqual([{ emoji: '😂', count: 3 }]);
	expect(compact.replyTo).toBe('42');
});

test('the DM fits in one Discord message', () => {
	const dm = reviewDm(
		'the fat club',
		'x'.repeat(3000),
		4,
		'https://dash.jessawg.space/server/1?tab=jjb'
	);
	expect(dm.length).toBeLessThanOrEqual(2000);
	expect(dm).toContain('4 notes/opinions flagged');
	expect(dm.endsWith('https://dash.jessawg.space/server/1?tab=jjb')).toBe(true);
});
