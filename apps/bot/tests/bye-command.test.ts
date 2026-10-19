/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

const { ByeCommand } = await import('../commands/bye');

test('/bye replies baibai', async () => {
	const reply = mock(async () => {});
	await ByeCommand.prototype.chatInputRun.call({} as any, { reply } as any);
	expect(reply).toHaveBeenCalledTimes(1);
	expect((reply.mock.calls[0] as any)[0].content).toBe('baibai');
});
