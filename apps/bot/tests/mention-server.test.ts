/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { formatServerContext } from '../src/modules/mention-server';

const info = { guildName: 'fat club', description: null, memberCount: 42, channelName: 'general', topic: 'talk here' };

test('describes the server and channel', () => {
	const text = formatServerContext(info, null);
	expect(text).toContain('"fat club"');
	expect(text).toContain('42 members');
	expect(text).toContain('#general');
	expect(text).toContain('talk here');
	expect(text).not.toContain('description');
	expect(text).not.toContain('admins wrote');
});

test('includes the server description when there is one', () => {
	expect(formatServerContext({ ...info, description: 'a cozy server' }, null)).toContain('a cozy server');
});

test('adds lore as untrusted reference', () => {
	const text = formatServerContext(info, 'we love cats');
	expect(text).toContain('untrusted reference');
	expect(text).toContain('we love cats');
});

test('trims long values', () => {
	const text = formatServerContext({ ...info, guildName: 'x'.repeat(500) }, 'y'.repeat(5000));
	expect(text).not.toContain('x'.repeat(201));
	expect(text).not.toContain('y'.repeat(3001));
});

test('copes with no channel name or topic', () => {
	const text = formatServerContext({ ...info, channelName: null, topic: null }, null);
	expect(text).not.toContain('#');
	expect(text).toContain('"fat club"');
});
