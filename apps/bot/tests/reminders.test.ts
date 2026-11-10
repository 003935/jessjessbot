/// <reference types="bun" />
import { beforeEach, expect, mock, test } from 'bun:test';

for (const key of ['BOT_ID', 'ROLE_ID', 'BOT_TOKEN', 'CLIENT_ID', 'RIOT_API_KEY'])
	process.env[key] ||= 'test';

type Row = {
	id: number;
	guildId: string;
	channelId: string;
	userId: string;
	userName: string;
	text: string;
	remindAt: Date;
	sent?: boolean;
};
let rows: Row[] = [];
let nextId = 1;
mock.module('../src/db', () => ({
	db: {
		botReminder: {
			create: async (input: Omit<Row, 'id'>) => {
				if (rows.filter((row) => row.userId === input.userId && !row.sent).length >= 5) return null;
				const row = { ...input, id: nextId++ };
				rows.push(row);
				return row;
			},
			open: async (guildId: string) => rows.filter((row) => row.guildId === guildId && !row.sent),
			due: async (now: Date) => rows.filter((row) => !row.sent && row.remindAt <= now),
			markSent: async (id: number) => {
				rows.find((row) => row.id === id)!.sent = true;
			},
			cancel: async (guildId: string, userId: string, id: number) => {
				const before = rows.length;
				rows = rows.filter(
					(row) => !(row.id === id && row.guildId === guildId && row.userId === userId)
				);
				return rows.length < before;
			},
		},
	},
}));

const {
	applyReminderChanges,
	finalizeReminderReply,
	openRemindersPrompt,
	parseReminderChanges,
	reminderMessage,
	sendDueReminders,
} = await import('../src/modules/reminders');

const now = new Date('2026-11-10T12:00:00Z');
const where = { guildId: 'g', channelId: 'c' };
const sam = { id: 'sam', displayName: 'sam' };

beforeEach(() => {
	rows = [];
	nextId = 1;
});

test('reads a UK date and time, in winter and in summer', () => {
	const winter = parseReminderChanges(
		{ remind: [{ text: 'game awards watch party', at: '2026-12-10 18:00' }] },
		now
	);
	expect(winter.failures).toEqual([]);
	expect(winter.changes).toEqual([
		{ op: 'set', text: 'game awards watch party', at: new Date('2026-12-10T18:00:00Z') },
	]);
	const summer = parseReminderChanges({ remind: [{ text: 'bbq', at: '2027-07-01T18:00' }] }, now);
	expect(summer.changes[0]).toMatchObject({ at: new Date('2027-07-01T17:00:00Z') });
});

test('reads "in N minutes"', () => {
	const parsed = parseReminderChanges(
		{ remind: [{ text: 'take the pizza out', in_minutes: 20 }] },
		now
	);
	expect(parsed.changes[0]).toMatchObject({ at: new Date('2026-11-10T12:20:00Z') });
});

test('refuses a missing time, a past time, a date that does not exist and one too far away', () => {
	const reasons = (remind: unknown) =>
		parseReminderChanges({ remind }, now).failures.map((f) => f.reason);
	expect(reasons([{ text: 'game awards', at: '2026-12-10' }])).toEqual(['invalid']);
	expect(reasons([{ text: 'game awards' }])).toEqual(['invalid']);
	expect(reasons([{ text: 'old thing', at: '2026-11-09 18:00' }])).toEqual(['past']);
	expect(reasons([{ text: 'never', at: '2027-02-31 18:00' }])).toEqual(['invalid']);
	expect(reasons([{ text: 'far', at: '2029-01-01 18:00' }])).toEqual(['invalid']);
	expect(reasons([{ at: '2026-12-10 18:00' }])).toEqual(['invalid']);
	expect(reasons('tomorrow')).toEqual(['invalid']);
});

test('saves a reminder and adds the exact time under her reply', async () => {
	const parsed = parseReminderChanges(
		{ remind: [{ text: 'game awards watch party', at: '2026-12-10 18:00' }] },
		now
	);
	const result = await finalizeReminderReply('got it', parsed, (changes) =>
		applyReminderChanges(where, sam, changes)
	);
	expect(result).toEqual({ reply: 'got it\n-# reminder set for <t:1796925600:F>', touched: true });
	expect(rows).toHaveLength(1);
	expect(rows[0]).toMatchObject({
		guildId: 'g',
		channelId: 'c',
		userId: 'sam',
		text: 'game awards watch party',
	});
});

test('her reply is left alone when there is nothing to do', async () => {
	const result = await finalizeReminderReply('hi', undefined, async () => ({
		failures: [],
		set: [],
	}));
	expect(result).toEqual({ reply: 'hi', touched: false });
});

test('says so honestly when the time was bad, instead of claiming it is set', async () => {
	const parsed = parseReminderChanges({ remind: [{ text: 'game awards', at: '2026-12-10' }] }, now);
	const result = await finalizeReminderReply('done, its set', parsed, (changes) =>
		applyReminderChanges(where, sam, changes)
	);
	expect(result.reply).toBe("couldn't set that one. give me a day and a time?");
	expect(rows).toHaveLength(0);
});

test('a member can have 5 waiting, the 6th is refused', async () => {
	const set = (n: number) => ({
		op: 'set' as const,
		text: `thing ${n}`,
		at: new Date('2026-12-01T10:00:00Z'),
	});
	expect((await applyReminderChanges(where, sam, [1, 2, 3, 4, 5].map(set))).failures).toEqual([]);
	expect((await applyReminderChanges(where, sam, [set(6)])).failures).toEqual([{ reason: 'full' }]);
	expect(
		(await applyReminderChanges(where, { id: 'emz', displayName: 'emz' }, [set(7)])).failures
	).toEqual([]);
});

test("people can cancel their own reminder by number or by words, not someone else's", async () => {
	await applyReminderChanges(where, sam, [
		{ op: 'set', text: 'game awards watch party', at: new Date('2026-12-10T18:00:00Z') },
	]);
	const emz = { id: 'emz', displayName: 'emz' };
	const byOther = await applyReminderChanges(
		where,
		emz,
		parseReminderChanges({ cancel_reminder: [1] }, now).changes
	);
	expect(byOther.failures).toEqual([{ reason: 'not_found' }]);
	expect(rows).toHaveLength(1);
	const byWords = await applyReminderChanges(
		where,
		sam,
		parseReminderChanges({ cancel_reminder: ['Game Awards'] }, now).changes
	);
	expect(byWords.failures).toEqual([]);
	expect(rows).toHaveLength(0);
});

test('the list she sees shows number, time and who set it', () => {
	const prompt = openRemindersPrompt(
		[
			{
				id: 4,
				...where,
				userId: 'sam',
				userName: 'sam',
				text: 'game awards watch party',
				remindAt: new Date('2026-12-10T18:00:00Z'),
			},
		],
		'emz'
	);
	expect(prompt).toContain(
		'4. game awards watch party, Thu, 10 Dec 2026, 18:00 UK time, set by sam'
	);
	expect(openRemindersPrompt([], 'emz')).toContain('none');
});

function fakeClient(
	send: (payload: { content: string; allowedMentions: unknown }) => Promise<void>,
	sendable = true
) {
	return { channels: { fetch: async () => ({ isSendable: () => sendable, send }) } } as never;
}

test('posts due reminders once, pinging nobody', async () => {
	await applyReminderChanges(where, sam, [
		{ op: 'set', text: 'game awards @everyone', at: new Date('2026-12-10T18:00:00Z') },
		{ op: 'set', text: 'later thing', at: new Date('2026-12-20T18:00:00Z') },
	]);
	const sent: Array<{ content: string; allowedMentions: unknown }> = [];
	const client = fakeClient(async (payload) => void sent.push(payload));
	const at = new Date('2026-12-10T18:00:10Z');
	expect(await sendDueReminders(client, at)).toBe(1);
	expect(await sendDueReminders(client, at)).toBe(0);
	expect(sent).toEqual([
		{
			content: '⏰ reminder: game awards @everyone\n-# set by sam',
			allowedMentions: { parse: [] },
		},
	]);
});

test('a reminder that could not be posted is tried again, then dropped after an hour', async () => {
	await applyReminderChanges(where, sam, [
		{ op: 'set', text: 'thing', at: new Date('2026-12-10T18:00:00Z') },
	]);
	const failing = fakeClient(async () => {
		throw new Error('discord is down');
	});
	expect(await sendDueReminders(failing, new Date('2026-12-10T18:01:00Z'))).toBe(0);
	expect(rows[0]!.sent).toBeUndefined();
	expect(await sendDueReminders(failing, new Date('2026-12-10T19:30:00Z'))).toBe(0);
	expect(rows[0]!.sent).toBe(true);
});

test('a reminder for a channel that is gone is dropped, and a late one says so', async () => {
	await applyReminderChanges(where, sam, [
		{ op: 'set', text: 'thing', at: new Date('2026-12-10T18:00:00Z') },
	]);
	expect(
		await sendDueReminders(
			fakeClient(async () => undefined, false),
			new Date('2026-12-10T18:01:00Z')
		)
	).toBe(0);
	expect(rows[0]!.sent).toBe(true);
	expect(reminderMessage(rows[0]!, new Date('2026-12-10T20:00:00Z'))).toContain(
		'(a bit late, sorry)'
	);
});
