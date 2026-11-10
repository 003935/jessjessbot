import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flagsToWrite, type ReviewFlagInput } from '../src/tables/bot_review';

const note = (key: string, text: string, userId = 'u1'): ReviewFlagInput => ({
	target: 'note',
	userId,
	key,
	text,
	reason: 'sounds like a database entry',
});

test('new flags are created', () => {
	const { create, reopen } = flagsToWrite([note('memory_note_a', 'plays league')], []);
	assert.equal(create.length, 1);
	assert.equal(reopen.length, 0);
});

test('a kept flag stays kept while the text is the same', () => {
	const { create, reopen } = flagsToWrite(
		[note('memory_note_a', 'plays league')],
		[note('memory_note_a', 'plays league')]
	);
	assert.equal(create.length + reopen.length, 0);
});

test('a kept flag is reopened when the note has changed', () => {
	const { create, reopen } = flagsToWrite(
		[note('memory_note_a', 'mains jinx')],
		[note('memory_note_a', 'plays league')]
	);
	assert.equal(create.length, 0);
	assert.deepEqual(
		reopen.map((flag) => flag.text),
		['mains jinx']
	);
});

test('the same item flagged twice is written once, and owners are kept apart', () => {
	const { create } = flagsToWrite(
		[note('memory_note_a', 'x'), note('memory_note_a', 'x'), note('memory_note_a', 'x', 'u2')],
		[]
	);
	assert.equal(create.length, 2);
});
