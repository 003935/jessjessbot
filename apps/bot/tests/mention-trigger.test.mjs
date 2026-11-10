import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botPrompt, botRoleAsMention } from '../src/modules/mention-trigger.ts';

test('pinging her managed role summons her like pinging her', () => {
	const content = botRoleAsMention('<@&456> confirm', '123', '456');
	assert.equal(content, '<@123> confirm');
	assert.equal(botPrompt(content, '123', true), 'confirm');
	assert.equal(botRoleAsMention('<@&789> confirm', '123', '456'), '<@&789> confirm');
	assert.equal(botRoleAsMention('<@&456> confirm', '123', undefined), '<@&456> confirm');
});

test('names summon jjb anywhere in a message', () => {
	assert.equal(botPrompt('jjb how are u', '123', false), 'how are u');
	assert.equal(botPrompt('hey jessjessbot, what do u think?', '123', false), 'hey jessjessbot, what do u think?');
	assert.equal(botPrompt('JJB', '123', false), 'hey');
	assert.equal(botPrompt('jessjessbot:', '123', false), 'hey');
	assert.equal(botPrompt('what does jjb think about this?', '123', false), 'what does jjb think about this?');
});

test('a typed @name (not a real ping) is stripped like the bare name', () => {
	// Her customs preview says "Reply @jessjessbot confirm"; people copy that as plain text.
	assert.equal(botPrompt('@jessjessbot confirm', '123', false), 'confirm');
	assert.equal(botPrompt('@jjb cancel', '123', false), 'cancel');
	assert.equal(botPrompt('@JJB', '123', false), 'hey');
});

test('real mentions still work and partial names stay quiet', () => {
	assert.equal(botPrompt('<@123> hello', '123', true), 'hello');
	assert.equal(botPrompt('what does <@123> think?', '123', true), 'what does jjb think?');
	assert.equal(botPrompt('jjbot is here', '123', false), null);
	assert.equal(botPrompt('superjessjessbotter', '123', false), null);
	assert.equal(botPrompt('hello', '123', false), null);
});

test('a bare ping is left to Meowdule so jjb only replies once', () => {
	assert.equal(botPrompt('<@!123>', '123', true), null);
	assert.equal(botPrompt('  <@123> <@123> ', '123', true), null);
	assert.equal(botPrompt('', '123', true, true), null);
	assert.equal(botPrompt('<@123>', '123', true, false, true), 'hey');
	assert.equal(botPrompt('', '123', false, true, true), 'hey');
});
