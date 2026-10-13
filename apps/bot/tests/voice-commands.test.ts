/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

const joinGuildVoice = mock(async () => {});
const leaveGuildVoice = mock(() => {});
mock.module('@/modules/voice/voice-manager', () => ({
	joinGuildVoice,
	leaveGuildVoice,
	enqueueGuildSpeech: () => false,
	VoiceCommandError: class extends Error {},
}));

const { JoinCommand } = await import('../commands/join');
const { LeaveCommand } = await import('../commands/leave');

function interaction() {
	return {
		guildId: 'guild',
		reply: mock(async () => {}),
		deferReply: mock(async () => {}),
		editReply: mock(async () => {}),
	};
}

test('/join and /leave refuse while voice is disabled', async () => {
	delete process.env.VOICE_ENABLED;
	for (const Command of [JoinCommand, LeaveCommand]) {
		const call = interaction();
		await Command.prototype.chatInputRun.call({} as any, call as any);
		expect(call.reply).toHaveBeenCalledTimes(1);
		expect((call.reply.mock.calls[0] as any)[0].content).toBe('voice isnt ready yet, soon (¬_¬)');
		expect(call.deferReply).not.toHaveBeenCalled();
	}
	expect(joinGuildVoice).not.toHaveBeenCalled();
	expect(leaveGuildVoice).not.toHaveBeenCalled();
});

test('/join and /leave work when voice is enabled', async () => {
	process.env.VOICE_ENABLED = 'true';
	try {
		const join = interaction();
		await JoinCommand.prototype.chatInputRun.call({} as any, join as any);
		expect(join.deferReply).toHaveBeenCalledTimes(1);
		expect(joinGuildVoice).toHaveBeenCalledTimes(1);
		const leave = interaction();
		await LeaveCommand.prototype.chatInputRun.call({} as any, leave as any);
		expect(leaveGuildVoice).toHaveBeenCalledWith('guild');
	} finally {
		delete process.env.VOICE_ENABLED;
	}
});
