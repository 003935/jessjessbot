import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hallMessageText } from '../src/utils';

test('extracts only text displays from nested jjb components', () => {
	assert.equal(
		hallMessageText({
			content: '',
			components: [
				{
					type: 17,
					components: [
						{ type: 9, components: [{ type: 10, content: '## Hall of Fame' }] },
						{ type: 10, content: 'A quote worth saving' },
						{ type: 1, components: [{ type: 2, label: 'Join', custom_id: 'custom:join' }] },
					],
				},
			],
		}),
		'## Hall of Fame A quote worth saving'
	);
});

test('prefers plain content and supports legacy embeds', () => {
	assert.equal(
		hallMessageText({ content: 'hello', components: [{ type: 10, content: 'other' }] }),
		'hello'
	);
	assert.equal(
		hallMessageText({
			content: '',
			embeds: [
				{ title: 'Result', description: 'You won', fields: [{ name: 'Score', value: '5' }] },
			],
		}),
		'Result You won Score 5'
	);
	assert.equal(hallMessageText({ content: '', components: [{ type: 2, label: 'Click me' }] }), '');
});
