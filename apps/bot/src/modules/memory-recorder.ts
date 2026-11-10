import type { Message } from 'discord.js';
import type { ChatLine } from '@repo/database';
import { db } from '@/db';
import { Logger } from '@/utils';
import { botRepliesEnabledIn, isPublicChannel } from '@/modules/mention';
import { topicWords } from '@/modules/mention-details';
import { extractMemory, type Person } from '@/modules/memory-extract';

// Watches conversations jjb is part of (her messages, messages to her or about her, and what
// the people talking with her say in between) and, once one goes quiet, saves it so she can
// look back at it and learns from it in one go. Chat she isn't part of is never recorded.

const logger = new Logger('MemoryRecorder');

export type RecordedMessage = {
	id: string;
	guildId: string;
	serverName: string;
	channelId: string;
	channelName: string;
	authorId: string;
	authorName: string;
	fromJjb: boolean;
	/** Mentions jjb, replies to her, or says her name. */
	toJjb: boolean;
	text: string;
	mentioned: Person[];
	at: number;
};

export type Conversation = {
	guildId: string;
	serverName: string;
	channelId: string;
	channelName: string;
	lines: Array<ChatLine & { id: string }>;
	/** People who talked to her or that she replied to. */
	participants: Set<string>;
	mentioned: Map<string, Person>;
	startedAt: number;
	lastJjbAt: number;
};

export const RECORDER_TIMING = {
	/** The conversation ends this long after the last message involving jjb. */
	idleMs: 10 * 60_000,
	/** Participants' messages count as part of it for this long after she was last involved. */
	followMs: 4 * 60_000,
	maxLines: 80,
};

const JJB_NAME = /\b(?:jjb|jessjessbot)\b/iu;

export class ConversationTracker {
	private open = new Map<string, Conversation>();
	private timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(
		private onClose: (conversation: Conversation) => void,
		private timing = RECORDER_TIMING,
		private schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
		private cancel: (timer: ReturnType<typeof setTimeout>) => void = clearTimeout
	) {}

	add(message: RecordedMessage): boolean {
		const involved = message.fromJjb || message.toJjb;
		let conversation = this.open.get(message.channelId);
		if (!conversation) {
			// Her own message only starts one when it's a reply to someone (toJjb is set for those).
			if (!message.toJjb) return false;
			conversation = {
				guildId: message.guildId,
				serverName: message.serverName,
				channelId: message.channelId,
				channelName: message.channelName,
				lines: [],
				participants: new Set(),
				mentioned: new Map(),
				startedAt: message.at,
				lastJjbAt: message.at,
			};
			this.open.set(message.channelId, conversation);
		} else if (
			!involved &&
			!(
				conversation.participants.has(message.authorId) &&
				message.at - conversation.lastJjbAt < this.timing.followMs
			)
		)
			return false;
		if (!message.text.trim()) return false;
		conversation.lines.push({
			id: message.id,
			userId: message.authorId,
			name: message.authorName,
			text: message.text.slice(0, 500),
			at: new Date(message.at).toISOString(),
		});
		if (!message.fromJjb && message.toJjb) conversation.participants.add(message.authorId);
		for (const person of message.mentioned) conversation.mentioned.set(person.id, person);
		if (involved) {
			conversation.lastJjbAt = message.at;
			this.restartTimer(message.channelId);
		}
		if (conversation.lines.length >= this.timing.maxLines) this.close(message.channelId);
		return true;
	}

	has(channelId: string): boolean {
		return this.open.has(channelId);
	}

	/** Replies she sends make the person she replied to a participant. */
	addParticipant(channelId: string, userId: string): void {
		this.open.get(channelId)?.participants.add(userId);
	}

	close(channelId: string): void {
		const conversation = this.open.get(channelId);
		const timer = this.timers.get(channelId);
		if (timer) this.cancel(timer);
		this.timers.delete(channelId);
		this.open.delete(channelId);
		if (conversation) this.onClose(conversation);
	}

	closeAll(): void {
		for (const channelId of [...this.open.keys()]) this.close(channelId);
	}

	private restartTimer(channelId: string): void {
		const timer = this.timers.get(channelId);
		if (timer) this.cancel(timer);
		this.timers.set(
			channelId,
			this.schedule(() => this.close(channelId), this.timing.idleMs)
		);
	}
}

/** Worth saving: she said something and someone else did too. */
export function worthSaving(conversation: { lines: ChatLine[] }, botId: string): boolean {
	const human = conversation.lines.filter((line) => line.userId !== botId);
	return human.length > 0 && human.length < conversation.lines.length;
}

/** Worth a model call: enough real words from people that there could be something to learn. */
export function worthLearning(conversation: { lines: ChatLine[] }, botId: string): boolean {
	const words = conversation.lines
		.filter((line) => line.userId !== botId)
		.reduce((sum, line) => sum + topicWords(line.text).size, 0);
	return words >= 4;
}

function displayName(message: Message<true>): string {
	return message.member?.displayName ?? message.author.globalName ?? message.author.username;
}

export function toRecorded(message: Message<true>, botId: string): RecordedMessage {
	const fromJjb = message.author.id === botId;
	const repliedToJjb = message.mentions.repliedUser?.id === botId;
	const toJjb = fromJjb
		? !!message.reference?.messageId
		: message.mentions.users.has(botId) || repliedToJjb || JJB_NAME.test(message.content);
	const attachments = message.attachments.size ? ' [image]' : '';
	return {
		id: message.id,
		guildId: message.guildId,
		serverName: message.guild.name,
		channelId: message.channelId,
		channelName: 'name' in message.channel ? (message.channel.name ?? '') : '',
		authorId: message.author.id,
		authorName: fromJjb ? 'jjb' : displayName(message),
		fromJjb,
		toJjb,
		text: `${message.cleanContent}${attachments}`.trim(),
		mentioned: [...(message.mentions.members?.values() ?? [])]
			.filter((member) => !member.user.bot && member.id !== message.author.id)
			.map((member) => ({ id: member.id, name: member.displayName, inChat: false })),
		at: message.createdTimestamp,
	};
}

let botUserId = '';

async function saveConversation(conversation: Conversation): Promise<void> {
	const botId = botUserId;
	const userIds = [
		...new Set(conversation.lines.map((line) => line.userId).filter((id) => id !== botId)),
	];
	const mentionedIds = [...conversation.mentioned.keys()].filter((id) => !userIds.includes(id));
	const memoryOff = new Set(
		(
			await Promise.all(
				[...userIds, ...mentionedIds].map(async (id) =>
					(await db.botMemberPreference.autoMemoryEnabled(conversation.guildId, id)) ? null : id
				)
			)
		).filter((id): id is string => !!id)
	);
	// People who turned memory off aren't kept at all, not even their lines.
	const lines = conversation.lines
		.filter((line) => !memoryOff.has(line.userId))
		.map(({ id: _id, ...line }) => line);
	if (!worthSaving({ lines }, botId)) return;
	const windowId = await db.botMemory.saveWindow(conversation.guildId, {
		channelId: conversation.channelId,
		channelName: conversation.channelName,
		lines,
		summary: '',
		startedAt: new Date(conversation.startedAt),
		endedAt: new Date(lines.at(-1)!.at),
	});
	if (!worthLearning({ lines }, botId)) return;
	const names = new Map(lines.map((line) => [line.userId, line.name]));
	const people: Person[] = [
		...userIds
			.filter((id) => !memoryOff.has(id))
			.map((id) => ({ id, name: names.get(id) ?? 'someone', inChat: true })),
		...mentionedIds.filter((id) => !memoryOff.has(id)).map((id) => conversation.mentioned.get(id)!),
	];
	const facts = await db.botMemory.current(conversation.guildId, [
		...people.map((person) => person.id),
		'',
	]);
	const now = new Date();
	const result = await extractMemory(
		{
			serverName: conversation.serverName,
			channelName: conversation.channelName,
			lines,
			people,
			facts: facts.slice(-120),
			botId,
			now,
		},
		memoryOff
	);
	if (!result) return;
	if (result.summary) await db.botMemory.setWindowSummary(windowId, result.summary);
	const firstId = conversation.lines[0]?.id ?? '';
	const saved =
		result.facts.length || result.replaces.length
			? await db.botMemory.add(
					conversation.guildId,
					result.facts.map((fact) => ({ ...fact, sourceMessageId: firstId })),
					result.replaces,
					now
				)
			: [];
	logger.info(
		`Saved a ${lines.length}-line conversation in #${conversation.channelName}; learned ${saved.length} fact(s), replaced ${result.replaces.length}`
	);
}

const saving = new Set<Promise<void>>();
const tracker = new ConversationTracker((conversation) => {
	const job = saveConversation(conversation)
		.catch((error) => logger.error('Could not save a conversation', error))
		.finally(() => saving.delete(job));
	saving.add(job);
});

/** Call for every message the bot sees, including its own. Cheap when jjb isn't involved. */
export function recordMemoryMessage(message: Message): void {
	if (!message.inGuild() || !isPublicChannel(message)) return;
	if (message.author.bot && message.author.id !== message.client.user.id) return;
	if (message.system) return;
	botUserId = message.client.user.id;
	const recorded = toRecorded(message, botUserId);
	// Quick check first so most messages never touch the database.
	if (!recorded.toJjb && !recorded.fromJjb && !tracker.has(recorded.channelId)) return;
	botRepliesEnabledIn(message)
		.then((enabled) => {
			if (!enabled && !recorded.fromJjb) return;
			tracker.add(recorded);
			const repliedTo = message.mentions.repliedUser?.id;
			if (recorded.fromJjb && repliedTo) tracker.addParticipant(recorded.channelId, repliedTo);
		})
		.catch((error) => logger.error('Could not record a message', error));
}

/** On shutdown: save what's open so a deploy doesn't lose it. */
export async function flushConversations(): Promise<void> {
	tracker.closeAll();
	await Promise.all([...saving]);
}
