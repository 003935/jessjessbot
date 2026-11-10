// The weekly reviewer (a scheduled agent outside the dashboard) reads jjb's notes, opinions
// and recent chat through /api/review, then posts flags and a report back. It signs in with
// the REVIEW_API_TOKEN bearer token; without that variable the API is switched off.

import { timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import type { APIMessage } from 'discord-api-types/v10';

const DISCORD_EPOCH = 1420070400000n;
export const MAX_REVIEW_DAYS = 30;
const MAX_CONTENT = 600;

export function tokenMatches(expected: string | undefined, header: string | null): boolean {
	if (!expected) return false;
	const given = header?.match(/^Bearer\s+(.+)$/iu)?.[1]?.trim() ?? '';
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

/** Throws 404 when the API is off (no token set) and 401 for a wrong token. */
export function requireReviewToken(expected: string | undefined, request: Request): void {
	if (!expected) error(404, 'Not found');
	if (!tokenMatches(expected, request.headers.get('authorization'))) error(401, 'Bad review token');
}

/** The earliest Discord message ID sent at or after this time. */
export function snowflakeAt(date: Date): string {
	const ms = BigInt(Math.max(date.getTime(), Number(DISCORD_EPOCH)));
	return ((ms - DISCORD_EPOCH) << 22n).toString();
}

export function snowflakeTime(id: string): Date {
	return new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
}

/** A `since` query value as a date, clamped to the last MAX_REVIEW_DAYS days. Defaults to 7 days ago. */
export function reviewSince(value: string | null, now = new Date()): Date {
	const earliest = new Date(now.getTime() - MAX_REVIEW_DAYS * 86_400_000);
	const parsed = value ? new Date(value) : new Date(now.getTime() - 7 * 86_400_000);
	if (Number.isNaN(parsed.getTime())) error(400, 'since must be an ISO date');
	return parsed < earliest ? earliest : parsed;
}

export type ReviewMessage = {
	id: string;
	at: string;
	author: { id: string; name: string; bot: boolean };
	content: string;
	replyTo: string | null;
	reactions: Array<{ emoji: string; count: number }>;
	attachments: number;
	embeds: number;
};

/** Just what the reviewer needs from a Discord message. */
export function compactMessage(message: APIMessage): ReviewMessage {
	const content = message.content ?? '';
	return {
		id: message.id,
		at: message.timestamp,
		author: {
			id: message.author.id,
			name: message.author.global_name || message.author.username,
			bot: !!message.author.bot,
		},
		content: content.length > MAX_CONTENT ? `${content.slice(0, MAX_CONTENT)}…` : content,
		replyTo: message.message_reference?.message_id ?? null,
		reactions: (message.reactions ?? []).map((reaction) => ({
			emoji: reaction.emoji.name ?? reaction.emoji.id ?? '?',
			count: reaction.count,
		})),
		attachments: message.attachments?.length ?? 0,
		embeds: message.embeds?.length ?? 0,
	};
}

const NAME_PATTERN = /\b(jjb|jessjessbot)\b/iu;

/** Whether a message is jjb's, talks to her, or answers her. */
export function involvesJjb(
	message: APIMessage,
	botId: string,
	jjbMessageIds: Set<string>
): boolean {
	if (message.author.id === botId) return true;
	if (message.mentions?.some((user) => user.id === botId)) return true;
	const replyTo = message.message_reference?.message_id;
	if (replyTo && jjbMessageIds.has(replyTo)) return true;
	return NAME_PATTERN.test(message.content ?? '');
}

/**
 * The stretches of a channel where jjb was part of it: each message that involves her plus a few
 * messages either side, merged when they overlap. Messages must be oldest first.
 */
export function conversationWindows(
	messages: APIMessage[],
	botId: string,
	before = 4,
	after = 6
): APIMessage[][] {
	const jjbIds = new Set(messages.filter((m) => m.author.id === botId).map((m) => m.id));
	const ranges: Array<[number, number]> = [];
	messages.forEach((message, index) => {
		if (!involvesJjb(message, botId, jjbIds)) return;
		const start = Math.max(0, index - before);
		const end = Math.min(messages.length - 1, index + after);
		const last = ranges.at(-1);
		if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
		else ranges.push([start, end]);
	});
	return ranges.map(([start, end]) => messages.slice(start, end + 1));
}

const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));

export const FlagsSchema = v.object({
	flags: v.pipe(
		v.array(
			v.variant('target', [
				v.object({
					target: v.literal('note'),
					userId: v.union([v.pipe(v.string(), v.regex(/^\d{5,25}$/u)), v.literal('')]),
					key: v.pipe(v.string(), v.startsWith('memory_'), v.maxLength(100)),
					reason: text(300),
				}),
				v.object({
					target: v.literal('opinion'),
					topic: text(200),
					reason: text(300),
				}),
			])
		),
		v.maxLength(500)
	),
});

export const ReportSchema = v.object({
	periodStart: v.pipe(v.string(), v.isoTimestamp()),
	periodEnd: v.pipe(v.string(), v.isoTimestamp()),
	summary: text(1500),
	report: text(20_000),
	dm: v.optional(v.boolean(), true),
});

/** The DM Jess gets when a review lands. Stays under Discord's 2000 characters. */
export function reviewDm(
	guildName: string,
	summary: string,
	openFlags: number,
	link: string
): string {
	const flagged = openFlags
		? `${openFlags} note${openFlags === 1 ? '' : 's'}/opinion${openFlags === 1 ? '' : 's'} flagged for you to check.`
		: 'Nothing flagged this week.';
	const footer = `\n\n${flagged}\nFull review: ${link}`;
	const head = `**Weekly jjb review · ${guildName}**\n`;
	const room = 2000 - head.length - footer.length;
	const body = summary.length > room ? `${summary.slice(0, room - 1)}…` : summary;
	return `${head}${body}${footer}`;
}
