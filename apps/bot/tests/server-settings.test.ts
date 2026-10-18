/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { CHAT_FALLBACK, DEEPSEEK_DOWN_SCENARIOS, GREETING_LINES, LAZY_LINES, MEME_PROMPT } from '@repo/database/defaults';
import { resolveServerSettings } from '../src/personality/server-settings';

const config = {
	bot_greeting_lines: [] as string[],
	bot_annoyed_lines: [] as string[],
	bot_lazy_lines: [] as string[],
	bot_fallback_reply: null as string | null,
	bot_down_lines: null as unknown,
	bot_meme_enabled: true,
	bot_meme_prompt: null as string | null,
};

test('empty config uses default lines', () => {
	const settings = resolveServerSettings(config);
	expect(settings.greetingLines).toEqual(GREETING_LINES);
	expect(settings.lazyLines).toEqual(LAZY_LINES);
	expect(settings.fallbackReply).toBe(CHAT_FALLBACK);
	expect(settings.downScenarios).toEqual(DEEPSEEK_DOWN_SCENARIOS);
	expect(settings.memePrompt).toBe(MEME_PROMPT);
});

test('saved lines win', () => {
	const settings = resolveServerSettings({ ...config, bot_greeting_lines: ['yo'], bot_fallback_reply: 'huh?' });
	expect(settings.greetingLines).toEqual(['yo']);
	expect(settings.fallbackReply).toBe('huh?');
});

test('blank entries are ignored and an all-blank list falls back', () => {
	expect(resolveServerSettings({ ...config, bot_greeting_lines: ['  '] }).greetingLines).toEqual(GREETING_LINES);
	expect(resolveServerSettings({ ...config, bot_greeting_lines: ['hi', ' '] }).greetingLines).toEqual(['hi']);
	expect(resolveServerSettings({ ...config, bot_fallback_reply: '   ' }).fallbackReply).toBe(CHAT_FALLBACK);
});

test('bad down-lines JSON falls back', () => {
	expect(resolveServerSettings({ ...config, bot_down_lines: { breakdown: 'nope' } }).downScenarios).toEqual(
		DEEPSEEK_DOWN_SCENARIOS
	);
	expect(resolveServerSettings({ ...config, bot_down_lines: { a: [[]] } }).downScenarios).toEqual(DEEPSEEK_DOWN_SCENARIOS);
	expect(resolveServerSettings({ ...config, bot_down_lines: [] }).downScenarios).toEqual(DEEPSEEK_DOWN_SCENARIOS);
	expect(resolveServerSettings({ ...config, bot_down_lines: { a: [['x']] } }).downScenarios).toEqual({ a: [['x']] });
});

test('meme can be turned off', () => {
	expect(resolveServerSettings({ ...config, bot_meme_enabled: false }).memeEnabled).toBe(false);
});
