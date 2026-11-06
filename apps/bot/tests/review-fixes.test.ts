/// <reference types="bun" />
import { afterEach, expect, mock, setSystemTime, test } from 'bun:test';
import { GREETING_LINES } from '@repo/database/defaults';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

let voiceRow: { personality: string | null } | null = { personality: 'voice A' };
const blankConfig = { bot_lore: null };
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

afterEach(() => setSystemTime());

test('a voice edit reaches a server within 60 seconds even if its settings were cached late', async () => {
	setSystemTime(new Date(1_000_000));
	await getVoice(); // voice A cached until +60s
	voiceRow = { personality: 'voice B' };
	setSystemTime(new Date(1_000_000 + 59_000));
	expect((await getBotSettings('g-cache')).voice?.personality).toBe('voice A');
	setSystemTime(new Date(1_000_000 + 61_000));
	expect((await getBotSettings('g-cache')).voice?.personality).toBe('voice B');
});

test('rare greeting lines come from the default list', () => {
	const realRandom = Math.random;
	Math.random = () => 0.02; // greeting roll
	try {
		setSystemTime(new Date(500_000_000)); // well past any cooldown other test files leave behind
		expect(GREETING_LINES).toContain(rareCasualLine('hi') ?? 'no line');
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
