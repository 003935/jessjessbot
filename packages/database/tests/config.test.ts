import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLore, PERSONALITY_DEFAULT, PERSONALITY_LIMITS } from '../src/defaults/personality';

test('personality default keeps every old voice section', () => {
	assert.ok(PERSONALITY_DEFAULT.includes('You are jessjessbot (jjb)'));
	assert.ok(PERSONALITY_DEFAULT.includes('NEVER use em dashes'));
	assert.ok(PERSONALITY_DEFAULT.includes('Example replies, for tone only'));
	assert.ok(PERSONALITY_DEFAULT.includes('Faces like ":3"'));
	assert.ok(PERSONALITY_DEFAULT.length <= PERSONALITY_LIMITS.personality);
});

test('blank lore is stored as null', () => {
	assert.equal(cleanLore('   \n '), null);
	assert.equal(cleanLore('  the fat club '), 'the fat club');
});
