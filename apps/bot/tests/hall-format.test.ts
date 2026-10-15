import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHallMarkdown } from '../src/modules/hall-format';

test('preserves static and animated custom emoji in hall quotes', () => {
	assert.equal(
		escapeHallMarkdown('A <:happy_cat:123456789> and <a:dancing_cat:987654321>!'),
		'A <:happy_cat:123456789> and <a:dancing_cat:987654321>\\!'
	);
});

test('escapes markdown and malformed emoji markup in hall quotes', () => {
	assert.equal(
		escapeHallMarkdown('**hello** [link](https://example.com) <:not_an_emoji:nope>'),
		'\\*\\*hello\\*\\* \\[link\\]\\(https://example\\.com\\) <:not\\_an\\_emoji:nope\\>'
	);
});
