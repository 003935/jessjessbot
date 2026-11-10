import { expect, test } from 'bun:test';
import { pickTab } from './server-tabs';

test('pickTab', () => {
	expect(pickTab(null, true)).toBe('overview');
	expect(pickTab('jjb', true)).toBe('jjb');
	expect(pickTab('settings', true)).toBe('settings');
	expect(pickTab('jjb', false)).toBe('overview');
	expect(pickTab('settings', false)).toBe('overview');
	expect(pickTab('nonsense', true)).toBe('overview');
});
