/// <reference types="bun" />
import { afterEach, expect, mock, setSystemTime, test } from 'bun:test';
import { DEEPSEEK_DOWN_SCENARIOS, storylinesFromText, storylinesToText } from '@repo/database/defaults';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

let voiceRow: { identity: string | null } | null = { identity: 'voice A' };
const blankConfig = {
	bot_personality: null,
	bot_likes: [],
	bot_dislikes: [],
	bot_lore: null,
	bot_greeting_lines: [],
	bot_annoyed_lines: [],
	bot_lazy_lines: [],
	bot_fallback_reply: null,
	bot_down_lines: null,
	bot_meme_enabled: true,
	bot_meme_prompt: null,
};
mock.module('../src/db', () => ({
	db: {
		botVoice: { get: async () => voiceRow },
		config: { getConfig: async () => blankConfig },
		botOpinion: { list: async () => [] },
	},
}));

const { getBotSettings, rareCasualLine } = await import('../src/modules/mention');
const { getVoice } = await import('../src/personality/voice');
const { serverContext } = await import('../src/modules/mention-server');
const { DEFAULT_SERVER_SETTINGS } = await import('../src/personality/server-settings');

afterEach(() => setSystemTime());

test('storylines with multi-line entries survive the dashboard editor round trip', () => {
	expect(storylinesFromText(storylinesToText(DEEPSEEK_DOWN_SCENARIOS.outOfOffice!))).toEqual(
		DEEPSEEK_DOWN_SCENARIOS.outOfOffice
	);
	expect(storylinesFromText(storylinesToText(DEEPSEEK_DOWN_SCENARIOS.breakdown!))).toEqual(
		DEEPSEEK_DOWN_SCENARIOS.breakdown
	);
	expect(storylinesFromText('one\n\ntwo\nstill two\n---\nthree')).toEqual([['one', 'two\nstill two'], ['three']]);
});

test('a voice edit reaches a server within 60 seconds even if its settings were cached late', async () => {
	setSystemTime(new Date(1_000_000));
	await getVoice(); // voice A cached until +60s
	voiceRow = { identity: 'voice B' };
	setSystemTime(new Date(1_000_000 + 59_000));
	expect((await getBotSettings('g-cache')).voice?.identity).toBe('voice A');
	setSystemTime(new Date(1_000_000 + 61_000));
	expect((await getBotSettings('g-cache')).voice?.identity).toBe('voice B');
});

test('rare lines come from the server list, and a one-line list never picks nothing', () => {
	const realRandom = Math.random;
	Math.random = () => 0.02; // greeting roll
	try {
		const settings = { ...DEFAULT_SERVER_SETTINGS, greetingLines: ['only hi'] };
		setSystemTime(new Date(10_000_000));
		expect(rareCasualLine('hi', settings)).toBe('only hi');
		setSystemTime(new Date(10_000_000 + 25 * 60_000));
		expect(rareCasualLine('hi', settings)).toBe('only hi');
	} finally {
		Math.random = realRandom;
	}
});

test('threads describe their parent channel', () => {
	const message = {
		guild: { name: 'fat club', description: null, memberCount: 5 },
		channel: { isThread: () => true, name: 'a thread', parent: { name: 'general', topic: 'talk here' } },
	} as unknown as Parameters<typeof serverContext>[0];
	const text = serverContext(message, null);
	expect(text).toContain('#general');
	expect(text).toContain('talk here');
	expect(text).not.toContain('a thread');
});
