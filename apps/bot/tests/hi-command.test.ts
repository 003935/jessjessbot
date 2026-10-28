/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

const { HiCommand } = await import('../commands/hi');

test('/hi replies hai', async () => {
	const reply = mock(async () => {});
	await HiCommand.prototype.chatInputRun.call({} as any, { reply } as any);
	expect(reply).toHaveBeenCalledTimes(1);
	expect((reply.mock.calls[0] as any)[0].content).toBe('hai');
});
