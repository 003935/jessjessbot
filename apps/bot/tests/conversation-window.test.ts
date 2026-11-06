/// <reference types="bun" />
import { expect, test } from 'bun:test';
import {
	CONVERSATION_WINDOW_MS,
	closeConversationWindow,
	extendConversationWindow,
	inConversationWindow,
	isDismissal,
} from '../src/modules/conversation-window';

test('the window lasts three minutes after she is called', () => {
	extendConversationWindow('a', 0);
	expect(inConversationWindow('a', CONVERSATION_WINDOW_MS - 1)).toBe(true);
	expect(inConversationWindow('a', CONVERSATION_WINDOW_MS)).toBe(false);
});

test('each reply pushes the end back', () => {
	extendConversationWindow('b', 0);
	extendConversationWindow('b', 2 * 60_000);
	expect(inConversationWindow('b', 4 * 60_000)).toBe(true);
	expect(inConversationWindow('b', 5 * 60_000)).toBe(false);
});

test('windows are per channel and can be closed', () => {
	extendConversationWindow('c', 0);
	expect(inConversationWindow('d', 1)).toBe(false);
	closeConversationWindow('c');
	expect(inConversationWindow('c', 1)).toBe(false);
});

test('shut up, go away and leave send her away', () => {
	for (const text of ['shutup', 'shut up', 'Shut up jjb!', 'go away', 'goaway', 'leave', 'pls leave', 'stfu', 'ok go away jjb'])
		expect(isDismissal(text)).toBe(true);
});

test('ordinary messages that mention leaving do not', () => {
	for (const text of ['i have to leave soon', 'leave him alone', 'dont go away', 'shut up and take my money', 'hi'])
		expect(isDismissal(text)).toBe(false);
});
