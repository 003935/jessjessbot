import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerCreatorQuestion, isCreatorQuestion, JESS_USER_ID } from '../src/modules/mention-creator.ts';

test('creator questions have one fixed answer', () => {
	assert.equal(isCreatorQuestion("isn't <@123> your creator and not <@456>?"), true);
	assert.equal(isCreatorQuestion('who is ur mom?'), true);
	assert.equal(isCreatorQuestion('what do i call <@456>?'), false);
	assert.equal(isCreatorQuestion('who created Path of Exile?'), false);
	for (const prompt of [
		'who made you',
		'who created jjb?',
		'whos ur mum',
		'is jess your mom?',
		'are u jess daughter',
	])
		assert.equal(isCreatorQuestion(prompt), true, prompt);
	for (const prompt of [
		'my mom said you could stay over tonight so if your mom is ok you can come and my mom will drop you back at your house tomorrow afternoon',
		'ur mom',
		'tell ur mom i said hi',
		'did you make this yourself',
		'my mom made you a sandwich',
		'this is all ur moms fault',
		'gg ez, that was ur mom',
	])
		assert.equal(isCreatorQuestion(prompt), false, prompt);
	assert.match(answerCreatorQuestion(), new RegExp(JESS_USER_ID));
	assert.doesNotMatch(answerCreatorQuestion(), /you can call her mom/iu);
});
