import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botPrompt } from '../src/modules/mention-trigger.ts';

test('names summon jjb anywhere in a message', () => {
	assert.equal(botPrompt('jjb how are u', '123', false), 'how are u');
	assert.equal(botPrompt('hey jessjessbot, what do u think?', '123', false), 'hey jessjessbot, what do u think?');
	assert.equal(botPrompt('JJB', '123', false), 'hey');
	assert.equal(botPrompt('jessjessbot:', '123', false), 'hey');
	assert.equal(botPrompt('what does jjb think about this?', '123', false), 'what does jjb think about this?');
});

test('real mentions still work and partial names stay quiet', () => {
	assert.equal(botPrompt('<@123> hello', '123', true), 'hello');
	assert.equal(botPrompt('<@!123>', '123', true), 'hey');
	assert.equal(botPrompt('what does <@123> think?', '123', true), 'what does jjb think?');
	assert.equal(botPrompt('jjbot is here', '123', false), null);
	assert.equal(botPrompt('superjessjessbotter', '123', false), null);
	assert.equal(botPrompt('hello', '123', false), null);
});
