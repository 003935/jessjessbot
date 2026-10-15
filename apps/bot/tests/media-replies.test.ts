/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
process.env.YUM_CHANNEL_ID = 'yum';
process.env.PET_CHANNEL_ID = 'pets';

const askDeepSeek = mock(async (..._args: unknown[]) => ({ reply: 'looks delicious 8/10' }));
mock.module('../src/modules/mention', () => ({
	askDeepSeek,
	isPublicChannel: (message: { channel: { public: boolean } }) => message.channel.public,
}));

const { handleMediaReply, mediaReplyKind } = await import('../src/modules/media-replies');

function message(channelId: string, content = '', attachments: object[] = []) {
	const reply = mock(async (_reply: unknown) => undefined);
	return {
		id: 'post',
		channelId,
		content,
		author: { id: 'person', username: 'person', bot: false },
		client: { user: { id: 'bot' } },
		mentions: { users: { has: (id: string) => content.includes(`<@${id}>`) } },
		attachments: new Map(attachments.map((attachment, index) => [index, attachment])),
		channel: { public: true, sendTyping: async () => undefined },
		reply,
		member: { displayName: 'Person' },
		reference: null,
	} as any;
}

test('only unaddressed posts in the two configured channels qualify', () => {
	expect(mediaReplyKind(message('yum'))).toBe('food');
	expect(mediaReplyKind(message('pets'))).toBe('pet');
	expect(mediaReplyKind(message('general'))).toBeNull();
	expect(mediaReplyKind(message('yum', 'jjb look'))).toBeNull();
	expect(mediaReplyKind(message('pets', '<@bot> look'))).toBeNull();
	expect(mediaReplyKind(message('pets'), true)).toBeNull();
	const fromBot = message('yum');
	fromBot.author.bot = true;
	expect(mediaReplyKind(fromBot)).toBeNull();
});

test('food image gets one contextual reply with rating and no user ping', async () => {
	const fetchBefore = globalThis.fetch;
	globalThis.fetch = mock(
		async () =>
			new Response(
				Buffer.from(
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l64AAAAASUVORK5CYII=',
					'base64'
				)
			)
	) as unknown as typeof fetch;
	const post = message('yum', 'made this', [
		{
			contentType: 'image/png',
			size: 123,
			name: 'dinner.png',
			url: 'https://example.com/dinner.png',
		},
	]);
	try {
		expect(await handleMediaReply(post)).toBe(true);
	} finally {
		globalThis.fetch = fetchBefore;
	}
	expect((askDeepSeek.mock.calls.at(-1)?.[12] as unknown[]).length).toBe(1);
	expect(askDeepSeek.mock.calls.at(-1)?.at(-1)).toBe('food');
	expect(post.reply).toHaveBeenCalledWith({
		content: 'looks delicious 8/10',
		allowedMentions: { parse: [], repliedUser: false },
	});
});

test('videos in both channels do not pretend to see frames', async () => {
	const video = {
		contentType: 'video/mp4',
		size: 123,
		name: 'clip.mp4',
		url: 'https://example.com/clip.mp4',
	};
	expect(await handleMediaReply(message('pets', '', [video]))).toBe(true);
	expect(await handleMediaReply(message('yum', 'my dinner', [video]))).toBe(true);
	expect(askDeepSeek.mock.calls.at(-1)?.[0]).toContain('cannot view its frames');
});

test('a reply to jjb is left to normal mention handling', async () => {
	const post = message('yum', '', [
		{ contentType: 'image/png', size: 123, url: 'https://example.com/x.png' },
	]);
	post.reference = { messageId: 'previous' };
	post.fetchReference = async () => ({ author: { id: 'bot' } });
	expect(await handleMediaReply(post)).toBe(false);
	expect(post.reply).not.toHaveBeenCalled();
});

test('private-channel media is never sent to vision or chat', async () => {
	const post = message('yum', '', [
		{ contentType: 'image/png', size: 123, url: 'https://example.com/private.png' },
	]);
	post.channel.public = false;
	askDeepSeek.mockClear();
	const fetchBefore = globalThis.fetch;
	const fetchSpy = mock(async () => {
		throw new Error('unexpected download');
	});
	globalThis.fetch = fetchSpy as unknown as typeof fetch;
	expect(await handleMediaReply(post)).toBe(false);
	globalThis.fetch = fetchBefore;
	expect(fetchSpy).not.toHaveBeenCalled();
	expect(askDeepSeek).not.toHaveBeenCalled();
});
