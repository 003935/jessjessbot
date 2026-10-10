import assert from 'node:assert/strict';
import test from 'node:test';
import { Meowdule } from '../src/modules/meowdule.ts';

test('does not send a cat reply when the bot is mentioned in an image-only message', () => {
	const meowdule = Object.create(Meowdule.prototype);
	meowdule.bot_user_id = 'bot-id';
	let replies = 0;
	const message = {
		mentions: { has: (id) => id === 'bot-id' },
		author: { id: 'user-id' },
		content: '<@bot-id>',
		attachments: new Map([['image', { contentType: 'image/png' }]]),
		reply: () => { replies += 1; },
	};

	meowdule.handleMsg(message);

	assert.equal(replies, 0);
});
