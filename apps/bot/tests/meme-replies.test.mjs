import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMemeReply } from '../src/modules/meme-replies.ts';

function message(content, mentioned = false) {
	const replies = [];
	return {
		replies,
		content,
		channelId: `channel-${Math.random()}`,
		author: { id: 'user-id', bot: false },
		client: { user: { id: 'bot-id' } },
		mentions: { users: { has: (id) => mentioned && id === 'bot-id' } },
		reply: async (options) => {
			replies.push(options.content);
		},
	};
}

test('jjb says meowmeow back when u say meowmeow to her', async () => {
	for (const [content, mentioned] of [
		['<@bot-id> meowmeow', true],
		['jjb meowmeow', false],
		['jjb, Meow Meow!', false],
	]) {
		const msg = message(content, mentioned);
		assert.equal(await handleMemeReply(msg), true, content);
		assert.deepEqual(msg.replies, ['meowmeow'], content);
	}
});

test('meowmeow not said to jjb, or in a longer message, is left alone', async () => {
	for (const [content, mentioned] of [
		['meowmeow', false],
		['jjb meowmeow how are u', false],
		['<@bot-id> meowmeowmeow', true],
	]) {
		const msg = message(content, mentioned);
		assert.equal(await handleMemeReply(msg), false, content);
		assert.deepEqual(msg.replies, [], content);
	}
});
