import type { Client } from 'discord.js';
import { MAX_OPEN_REMINDERS, type Reminder } from '@repo/database';
import { db } from '@/db';
import { Logger } from '@/utils';
import { londonParts, londonTime } from '@/modules/mention-customs';
import { filterBotOutput } from '@/modules/output-filter';

// People ask jjb in chat to remind them of something. She sets it through reply_chat's remind and
// cancel_reminder fields; this file checks those untrusted model outputs, saves the reminder, and
// posts it in the same channel when its time comes. Reminders never ping anyone.

const logger = new Logger('Reminders');

const MAX_CHANGES = 5;
const MAX_TEXT_LENGTH = 200;
const MIN_LEAD_MS = 30_000;
const MAX_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 30_000;
// A reminder that could not be posted is retried for this long, then dropped.
const GIVE_UP_AFTER_MS = 60 * 60 * 1000;
const LATE_AFTER_MS = 30 * 60 * 1000;

export type ReminderChange =
	{ op: 'set'; text: string; at: Date } | { op: 'cancel'; id: number | null; text: string | null };
export type ReminderFailure = { reason: 'full' | 'past' | 'invalid' | 'not_found' | 'error' };

export const REMINDER_TOOL_PROPERTIES = {
	remind: {
		type: 'array',
		description:
			'Reminders to set, only when someone asks you to remind them or the server of something and you know both the day and the time of day. If they gave no time of day, leave this out and ask what time.',
		items: {
			type: 'object',
			properties: {
				text: {
					type: 'string',
					description: 'What to say when it goes off, short, like "game awards watch party"',
				},
				at: {
					type: 'string',
					description:
						'When, in UK time, as YYYY-MM-DD HH:MM (24 hour). Use this for a day and time.',
				},
				in_minutes: {
					type: 'number',
					description: 'Use this instead of at for "in 20 minutes" or "in 2 hours".',
				},
			},
			required: ['text'],
		},
	},
	cancel_reminder: {
		type: 'array',
		description:
			"Reminders of the current speaker's to cancel, only when they ask. Use the number from the open reminders list.",
		items: { type: 'number' },
	},
} as const;

export function reminderPrompt(now = new Date()): string {
	const time = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/London',
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(now);
	return `Reminders are an action you can do from this reply. When someone asks you to remind them or the server about something, put it in reply_chat's remind list. You need a day and a time of day: if they only gave a day ("on dec 10th"), do not set it, ask what time. Never guess or make up a time. "Remember this" on its own is memory, not a reminder; if it is about an upcoming event you can ask once if they want a reminder too. When you set one, confirm in a few words; the app adds the exact time under your reply, and tells them if it failed. A reminder is posted in this channel at that time and pings nobody. Each person can have ${MAX_OPEN_REMINDERS} waiting. People can only cancel their own. Only say a reminder is set or cancelled if you included it in remind or cancel_reminder. Right now it is ${time}, UK time.`;
}

function cleanText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.replace(/\s+/gu, ' ').trim();
	return text.length >= 2 && text.length <= MAX_TEXT_LENGTH ? text : null;
}

function parseAt(value: unknown): Date | null {
	if (typeof value !== 'string') return null;
	const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/u);
	if (!match) return null;
	const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
		number,
		number,
		number,
		number,
		number,
	];
	if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
	const date = londonTime(year, month, day, hour, minute);
	if (!date) return null;
	// 31 feb and the like roll over into another day; treat those as mistakes.
	const parts = londonParts(date);
	return parts.month === month && parts.day === day ? date : null;
}

/** Validates the model's remind/cancel_reminder fields; anything malformed is dropped and counted. */
export function parseReminderChanges(
	args: { remind?: unknown; cancel_reminder?: unknown },
	now = new Date()
): { changes: ReminderChange[]; failures: ReminderFailure[] } {
	const changes: ReminderChange[] = [];
	const failures: ReminderFailure[] = [];
	for (const item of Array.isArray(args.remind) ? args.remind : args.remind == null ? [] : [null]) {
		const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
		const text = cleanText(raw.text);
		const minutes =
			typeof raw.in_minutes === 'number' && Number.isFinite(raw.in_minutes) ? raw.in_minutes : null;
		const at = minutes !== null ? new Date(now.getTime() + minutes * 60_000) : parseAt(raw.at);
		if (!text || !at) failures.push({ reason: 'invalid' });
		else if (at.getTime() - now.getTime() < MIN_LEAD_MS) failures.push({ reason: 'past' });
		else if (at.getTime() - now.getTime() > MAX_FUTURE_MS) failures.push({ reason: 'invalid' });
		else if (changes.length >= MAX_CHANGES) failures.push({ reason: 'invalid' });
		else changes.push({ op: 'set', text, at });
	}
	const cancels = Array.isArray(args.cancel_reminder)
		? args.cancel_reminder
		: args.cancel_reminder == null
			? []
			: [args.cancel_reminder];
	for (const item of cancels) {
		const id =
			typeof item === 'number'
				? item
				: typeof item === 'string' && /^#?\d+$/u.test(item.trim())
					? Number(item.trim().replace('#', ''))
					: null;
		const text = id === null ? cleanText(item) : null;
		if (id === null && !text) failures.push({ reason: 'invalid' });
		else if (changes.length >= MAX_CHANGES) failures.push({ reason: 'invalid' });
		else changes.push({ op: 'cancel', id, text: text?.toLocaleLowerCase() ?? null });
	}
	return { changes, failures };
}

/** Saves and cancels reminders for the speaker. */
export async function applyReminderChanges(
	where: { guildId: string; channelId: string },
	speaker: { id: string; displayName: string },
	changes: ReminderChange[]
): Promise<{ failures: ReminderFailure[]; set: Reminder[] }> {
	const failures: ReminderFailure[] = [];
	const set: Reminder[] = [];
	for (const change of changes) {
		try {
			if (change.op === 'set') {
				const saved = await db.botReminder.create({
					...where,
					userId: speaker.id,
					userName: speaker.displayName.slice(0, 80),
					text: change.text,
					remindAt: change.at,
				});
				if (saved) set.push(saved);
				else failures.push({ reason: 'full' });
				continue;
			}
			let id = change.id;
			if (id === null) {
				const mine = (await db.botReminder.open(where.guildId, 100)).filter(
					(reminder) =>
						reminder.userId === speaker.id &&
						reminder.text.toLocaleLowerCase().includes(change.text!)
				);
				id = mine.length === 1 ? mine[0]!.id : null;
			}
			if (id === null || !(await db.botReminder.cancel(where.guildId, speaker.id, id)))
				failures.push({ reason: 'not_found' });
		} catch (error) {
			logger.error('Could not apply a reminder change', error);
			failures.push({ reason: 'error' });
		}
	}
	return { failures, set };
}

export function reminderFailureReply(failures: ReminderFailure[]): string {
	const reason = failures[0]?.reason;
	if (reason === 'full')
		return `u already have ${MAX_OPEN_REMINDERS} reminders waiting, cancel one first`;
	if (reason === 'past') return 'that time already passed. when do u mean?';
	if (reason === 'not_found') return "couldn't find a reminder of urs like that";
	return "couldn't set that one. give me a day and a time?";
}

const stamp = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:F>`;

/** Applies the reply's reminder changes. Her reply gets the exact time added, or becomes an honest one if anything failed. */
export async function finalizeReminderReply(
	reply: string,
	parsed: { changes: ReminderChange[]; failures: ReminderFailure[] } | undefined,
	apply: (changes: ReminderChange[]) => Promise<{ failures: ReminderFailure[]; set: Reminder[] }>
): Promise<{ reply: string; touched: boolean }> {
	if (!parsed || (!parsed.changes.length && !parsed.failures.length))
		return { reply, touched: false };
	const result = parsed.changes.length ? await apply(parsed.changes) : { failures: [], set: [] };
	const failures = [...parsed.failures, ...result.failures];
	const times = result.set.map((reminder) => `-# reminder set for ${stamp(reminder.remindAt)}`);
	return {
		reply: [failures.length ? reminderFailureReply(failures) : reply, ...times].join('\n'),
		touched: true,
	};
}

const listTime = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/London',
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
});

/** True when the message is about reminders, so the waiting ones are worth showing her. */
export function mentionsReminders(prompt: string): boolean {
	return /\bremind/iu.test(prompt);
}

/** The server's waiting reminders, for her prompt. */
export function openRemindersPrompt(reminders: Reminder[], speakerId: string): string {
	if (!reminders.length) return 'Open reminders in this server: none.';
	const lines = reminders.map(
		(reminder) =>
			`${reminder.id}. ${reminder.text}, ${listTime.format(reminder.remindAt)} UK time, set by ${reminder.userName}${reminder.userId === speakerId ? ' (the person talking to you now, so they can cancel it)' : ''}`
	);
	return `Open reminders in this server (number, what, when, who set it). Only mention them if asked:\n${lines.join('\n')}`;
}

export function reminderMessage(reminder: Reminder, now = new Date()): string {
	const late = now.getTime() - reminder.remindAt.getTime() > LATE_AFTER_MS;
	return filterBotOutput(
		`⏰ reminder: ${reminder.text}${late ? ' (a bit late, sorry)' : ''}\n-# set by ${reminder.userName}`
	);
}

/** Posts every reminder whose time has come. Returns how many were posted. */
export async function sendDueReminders(client: Client<true>, now = new Date()): Promise<number> {
	let sent = 0;
	for (const reminder of await db.botReminder.due(now)) {
		try {
			const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
			if (!channel?.isSendable()) {
				logger.warn(`Dropped reminder ${reminder.id}: its channel is gone or closed to me`);
				await db.botReminder.markSent(reminder.id);
				continue;
			}
			await channel.send({
				content: reminderMessage(reminder, now),
				allowedMentions: { parse: [] },
			});
			await db.botReminder.markSent(reminder.id);
			sent++;
		} catch (error) {
			logger.error(`Could not post reminder ${reminder.id}`, error);
			if (now.getTime() - reminder.remindAt.getTime() > GIVE_UP_AFTER_MS)
				await db.botReminder.markSent(reminder.id).catch(() => undefined);
		}
	}
	return sent;
}

export function startReminderChecker(client: Client<true>): void {
	let busy = false;
	const run = async () => {
		if (busy) return;
		busy = true;
		try {
			const sent = await sendDueReminders(client);
			if (sent) logger.info(`Posted ${sent} reminder(s)`);
		} catch (error) {
			logger.error('Reminder check failed', error);
		} finally {
			busy = false;
		}
	};
	setInterval(() => void run(), CHECK_EVERY_MS);
	void run();
}
