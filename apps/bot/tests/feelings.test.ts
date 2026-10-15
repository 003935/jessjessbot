/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';
mock.module('../src/db', () => ({ db: {} }));

const { feelingsPrompt, isFeelingsTalk, relationshipTone } =
	await import('../src/modules/mention-relationship');

test('spots questions about how she feels and affection aimed at her', () => {
	for (const prompt of [
		'do u even like me',
		'how do you feel about me',
		'what am i to u',
		'am i ur favourite',
		'are we friends',
		'i love u jjb',
		'ily',
		'ur my fav',
		'*hugs*',
		'hugs jjb',
		'do you still hate me',
		'marry me',
	])
		expect(isFeelingsTalk(prompt)).toBe(true);
	for (const prompt of [
		'i love pizza',
		'do u like sushi',
		'how do i fix my pc',
		'hug emoji is weird',
	])
		expect(isFeelingsTalk(prompt)).toBe(false);
});

test('the answer reflects where the relationship stands and how much they talk', () => {
	const stranger = feelingsPrompt(0, 2, () => 0);
	expect(stranger).toContain('no strong feelings about them yet');
	expect(stranger).toContain('barely talked');
	expect(stranger).toContain('weirdly specific rating out of 10');
	const bestie = feelingsPrompt(85, 400, () => 0);
	expect(bestie).toContain('genuinely care about them');
	expect(bestie).toContain('a real regular');
	expect(feelingsPrompt(-40, 30, () => 0)).toContain('rude to you');
	expect(feelingsPrompt(30, 30, () => 0)).toContain('rather not admit it');
});

test('different rolls give different angles', () => {
	const angles = new Set(
		[0, 0.2, 0.4, 0.6, 0.8, 0.99].map((roll) => feelingsPrompt(10, 10, () => roll))
	);
	expect(angles.size).toBeGreaterThan(4);
});

test('no tier hands her a stock "ur ok" line any more', () => {
	for (const score of [-80, -30, 0, 30, 60, 90])
		expect(relationshipTone(score)).not.toMatch(/ur ok|ask me again later|ur alright/u);
});
