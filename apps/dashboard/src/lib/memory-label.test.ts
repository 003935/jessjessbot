import { describe, expect, test } from 'bun:test';
import { factLabel } from './memory-label';

const base = {
	source: 'self',
	kind: 'fact',
	saidByName: '',
	createdAt: '2026-11-03T10:00:00Z',
	expiresAt: null,
};

describe('factLabel', () => {
	test('plain fact shows month and year', () => {
		expect(factLabel(base)).toBe('nov 2026');
	});
	test('friend facts say who told her', () => {
		expect(factLabel({ ...base, source: 'friend', saidByName: 'sam' })).toBe('from sam, nov 2026');
	});
	test('plans show when they end', () => {
		expect(factLabel({ ...base, kind: 'plan', expiresAt: '2026-11-14T00:00:00Z' })).toBe(
			'plan until 14 nov'
		);
	});
});
