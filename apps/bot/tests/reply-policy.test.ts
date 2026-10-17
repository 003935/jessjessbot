/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

mock.module('../src/db', () => ({
	db: { config: { getConfig: async () => ({ bot_ignored_channels: ['quiet'] }) } },
}));

const { botRepliesEnabledIn, isPublicChannel } = await import('../src/modules/mention');

function message(channel: object, channelId: string) {
	return { inGuild: () => true, guild: { id: 'guild' }, channelId, channel } as any;
}

test('an ignored channel inside a category stays ignored', async () => {
	const channel = {
		id: 'quiet',
		parentId: 'category',
		parent: { id: 'category' },
		isThread: () => false,
	};
	expect(await botRepliesEnabledIn(message(channel, 'quiet'))).toBe(false);
});

test('a thread follows its parent channel', async () => {
	const ignoredThread = {
		id: 'thread-1',
		parentId: 'quiet',
		parent: { id: 'quiet' },
		isThread: () => true,
	};
	expect(await botRepliesEnabledIn(message(ignoredThread, 'thread-1'))).toBe(false);
	const otherThread = {
		id: 'thread-2',
		parentId: 'general',
		parent: { id: 'general' },
		isThread: () => true,
	};
	expect(await botRepliesEnabledIn(message(otherThread, 'thread-2'))).toBe(true);
});

test('channels that are not ticked still get replies', async () => {
	const channel = {
		id: 'general',
		parentId: 'category',
		parent: { id: 'category' },
		isThread: () => false,
	};
	expect(await botRepliesEnabledIn(message(channel, 'general'))).toBe(true);
});

test('public-channel guard rejects channels restricted from everyone', () => {
	const channel = {
		type: 0,
		permissionsFor: () => ({ has: () => false }),
	};
	expect(isPublicChannel({ channel, guild: { roles: { everyone: {} } } } as any)).toBe(false);
	channel.permissionsFor = () => ({ has: () => true });
	expect(isPublicChannel({ channel, guild: { roles: { everyone: {} } } } as any)).toBe(true);
});
