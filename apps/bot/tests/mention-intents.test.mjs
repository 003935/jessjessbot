import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	isEventSetupRequest,
	isRandomMemberRequest,
	isRecapRequest,
	isWordleLeaderboardRequest,
	isWordleWinsRequest,
	limitChatReply,
} from '../src/modules/mention-intents.ts';

test('ordinary game questions never route to Wordle', () => {
	for (const prompt of [
		'who wins kled vs olaf',
		'whos the king of the jungle',
		'enemy blind picked nilah adc, what do I pick to maximize my win possibility',
		'who would win in a boxing match, me or Facen',
	]) {
		assert.equal(isWordleLeaderboardRequest(prompt), false);
		assert.equal(isWordleWinsRequest(prompt), false);
	}
	assert.equal(isWordleLeaderboardRequest('show the Wordle king leaderboard'), true);
	assert.equal(isWordleWinsRequest('how many Wordle wins do I have?'), true);
	assert.equal(isWordleLeaderboardRequest('who is king?', true), true);
	assert.equal(isWordleWinsRequest('how many wins do I have?', true), true);
});

test('media summaries stay chat replies, while channel recaps use the recap tool', () => {
	assert.equal(isRecapRequest('summarise Chainsaw Man in 5 words'), false);
	assert.equal(isRecapRequest('summarise Attack on Titan in 5 words'), false);
	assert.equal(isRecapRequest('tldr past hour'), true);
	assert.equal(isRecapRequest('summarise this channel'), true);
});

test('event tools require an event setup request', () => {
	assert.equal(isEventSetupRequest('let’s play blackjack'), false);
	assert.equal(isEventSetupRequest('set up League customs tonight at 7pm'), true);
	assert.equal(isEventSetupRequest('can we do customs tomorrow?'), true);
});

test('a random member request does not match violent roleplay', () => {
	assert.equal(isRandomMemberRequest('pick a random person from this server'), true);
	assert.equal(isRandomMemberRequest('shoot a random person in the server'), false);
});

test('ordinary chat uses a character limit while requested steps keep their layout', () => {
	const longReply = 'This is a long answer with lots of detail. '.repeat(15);
	assert.ok(limitChatReply(longReply, 'what do u think?').length <= 500);
	assert.ok(limitChatReply(longReply, 'give me a recipe').length > 500);
	assert.equal(limitChatReply('step 1: try it\nstep 2: profit', 'give me step by step instructions'), 'step 1: try it\nstep 2: profit');
	assert.equal(limitChatReply('first line\nsecond line', 'hello'), 'first line second line');
});
