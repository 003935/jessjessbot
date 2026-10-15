import { afterEach, expect, test } from 'bun:test';

const original = process.env.OUTPUT_BLOCKED_WORDS;

afterEach(() => {
	if (original === undefined) delete process.env.OUTPUT_BLOCKED_WORDS;
	else process.env.OUTPUT_BLOCKED_WORDS = original;
});

async function filterWith(words: string, content: string) {
	process.env.OUTPUT_BLOCKED_WORDS = words;
	const { filterBotOutput } = await import(
		`../src/modules/output-filter.ts?words=${encodeURIComponent(words)}`
	);
	return filterBotOutput(content);
}

test('allows replies when no list is configured', async () => {
	expect(await filterWith('', 'hello')).toBe('hello');
});

test('blocks whole words and phrases without echoing the matched output', async () => {
	expect(await filterWith(' forbidden, bad phrase ', 'A FORBIDDEN reply')).toBe(
		"I can't respond to that."
	);
	expect(await filterWith('forbidden, bad phrase', 'a bad phrase!')).toBe(
		"I can't respond to that."
	);
	expect(await filterWith('forbidden', 'unforbidden')).toBe('unforbidden');
	expect(await filterWith('bad', 'ＢＡＤ')).toBe("I can't respond to that.");
});

test('treats entries as literal text and catches invisible separators', async () => {
	expect(await filterWith('b.d', 'b.d')).toBe("I can't respond to that.");
	expect(await filterWith('b.d', 'bad')).toBe('bad');
	expect(await filterWith('bad', 'b\u200bad')).toBe("I can't respond to that.");
});
