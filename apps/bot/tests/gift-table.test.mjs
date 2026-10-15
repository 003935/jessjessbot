import { test } from 'node:test';
import assert from 'node:assert/strict';
import { giftPoints, giftReaction, giftTaste, parseGift } from '../src/modules/gift-table.ts';

test('gift phrasings are recognised', () => {
	assert.equal(parseGift('*gives u a mango*'), 'mango');
	assert.equal(parseGift('*hands jjb boba*'), 'boba');
	assert.equal(parseGift('gives u some wasabi'), 'wasabi');
	assert.equal(parseGift('i got u a bowl of hot pot'), 'hot pot');
	assert.equal(parseGift("here's a strawberry cake for u"), 'strawberry cake');
	assert.equal(parseGift('gift: celery'), 'celery');
});

test('normal chat is not a gift', () => {
	for (const prompt of ['i got u bro', 'give me the sage kitten role', "here's the link", 'gives u a reason to live and also a whole paragraph of text', 'kisses u'])
		assert.equal(parseGift(prompt), null, prompt);
});

test('tastes follow her likes and dislikes', () => {
	assert.equal(giftTaste('mango'), 'loved');
	assert.equal(giftTaste('mango with wasabi'), 'hated');
	assert.equal(giftTaste('strawberry cake'), 'liked');
	assert.equal(giftTaste('celery'), 'disliked');
	assert.equal(giftTaste('a lamp'), 'neutral');
	assert.equal(giftTaste('red bull'), 'liked');
	assert.equal(giftPoints('red bull', 'liked'), 2);
	assert.equal(giftPoints('cake', 'liked'), 4);
	assert.match(giftReaction('wasabi', 'hated', false, 0), /ick/u);
});
