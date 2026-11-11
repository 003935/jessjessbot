/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

const { asksAboutUpdates, loadUpdates, updatesPrompt } = await import('../src/modules/updates');

test('reads update files newest first and skips other files', () => {
	const dir = mkdtempSync(join(tmpdir(), 'jjb-updates-'));
	writeFileSync(join(dir, '2026-11-06-emotes.md'), 'jjb can add emotes.\n');
	writeFileSync(join(dir, '2026-11-10-memory.md'), 'New memory.\nIt has dates.\n');
	writeFileSync(join(dir, 'README.md'), 'how to add one');
	writeFileSync(join(dir, '2026-11-11-empty.md'), '  \n');
	expect(loadUpdates(dir)).toEqual([
		{ date: '2026-11-10', text: 'New memory. It has dates.' },
		{ date: '2026-11-06', text: 'jjb can add emotes.' },
	]);
	expect(loadUpdates(join(dir, 'missing'))).toEqual([]);
});

test('the real updates folder loads and every entry is short', () => {
	const updates = loadUpdates();
	expect(updates.length).toBeGreaterThan(0);
	for (const update of updates) expect(update.text.length).toBeLessThan(400);
});

test('notices questions about her changing, not ordinary chat', () => {
	for (const prompt of [
		'jjb any new update',
		'jjb reminders feature?',
		'whats new with u',
		'what changed jjb',
		'i liked the old jjb better',
		'u used to be funnier',
		'did jess patch u',
		'why are u so different now',
	])
		expect([prompt, asksAboutUpdates(prompt)]).toEqual([prompt, true]);
	for (const prompt of ['jjb im home', 'what should i eat', 'who won fat bear week', 'gm'])
		expect([prompt, asksAboutUpdates(prompt)]).toEqual([prompt, false]);
});

test('shows recent changes with dates, keeps a few old ones, and caps the list', () => {
	const now = new Date('2026-11-12T12:00:00Z');
	const prompt = updatesPrompt(
		[
			{ date: '2026-11-10', text: 'New memory.' },
			{ date: '2026-11-06', text: 'Emotes.' },
		],
		now
	);
	expect(prompt).toContain('- 2 days ago: New memory.\n- 6 days ago: Emotes.');
	expect(updatesPrompt([{ date: '2026-11-12', text: 'a' }], now)).toContain('- today: a');
	expect(updatesPrompt([{ date: '2026-10-20', text: 'a' }], now)).toContain(
		'- 3 weeks ago (20 Oct): a'
	);
	expect(updatesPrompt([], now)).toBe('');
	const old = Array.from({ length: 6 }, (_, i) => ({
		date: `2025-01-0${i + 1}`,
		text: `old ${i}`,
	}));
	expect(updatesPrompt(old, now).match(/^- /gmu)).toHaveLength(4);
	const many = Array.from({ length: 20 }, (_, i) => ({ date: '2026-11-01', text: `new ${i}` }));
	expect(updatesPrompt(many, now).match(/^- /gmu)).toHaveLength(12);
});
