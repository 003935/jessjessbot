import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerCreatorQuestion, isCreatorQuestion, JESS_USER_ID } from '../src/modules/mention-creator.ts';

test('creator questions have one fixed answer', () => {
	assert.equal(isCreatorQuestion("isn't <@123> your creator and not <@456>?"), true);
	assert.equal(isCreatorQuestion('who is ur mom?'), true);
	assert.equal(isCreatorQuestion('what do i call <@456>?'), false);
	assert.equal(isCreatorQuestion('who created Path of Exile?'), false);
	assert.match(answerCreatorQuestion(), new RegExp(JESS_USER_ID));
	assert.doesNotMatch(answerCreatorQuestion(), /you can call her mom/iu);
});
