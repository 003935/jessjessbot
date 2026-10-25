import { db } from '@/db';
import { Client, User } from 'discord.js';
import { Logger } from '@/utils';

const logger = new Logger('Events');

type Event = {
	id: number;
	guildId: string;
	channelId: string;
	messageId: string;
	scheduledTime: Date;
	gameName: string;
	teamCount: number;
};

const teamEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

export async function getEventSignups(client: Client<true>, event: Event) {
	const channel = await client.channels.fetch(event.channelId);
	if (!channel?.isTextBased() || !('messages' in channel))
		throw new Error('Signup channel unavailable');
	const message = await channel.messages.fetch(event.messageId);
	const emojis = event.teamCount ? teamEmoji.slice(0, event.teamCount) : ['✅'];
	const seen = new Set<string>();
	const groups = [];
	for (const emoji of emojis) {
		const reaction = message.reactions.resolve(emoji);
		const users: User[] = [];
		let after: string | undefined;
		if (reaction) {
			while (true) {
				const page = await reaction.users.fetch({ limit: 100, ...(after ? { after } : {}) });
				for (const user of page.values()) {
					if (!user.bot && !seen.has(user.id)) {
						seen.add(user.id);
						users.push(user);
					}
				}
				if (page.size < 100) break;
				after = page.last()?.id;
			}
		}
		groups.push({ emoji, users });
	}
	if (!event.teamCount) {
		const joined = groups[0]!.users;
		const records = await db.events.getSignups(event.id);
		const overrides = new Map(records.map((record) => [record.userId, record.status]));
		const filteredLegacy = joined.filter((user) => !overrides.has(user.id));
		joined.splice(0, joined.length, ...filteredLegacy);
		const seenJoined = new Set(joined.map((user) => user.id));
		for (const record of records) {
			if (record.status !== 'JOINED' || seenJoined.has(record.userId)) continue;
			const user = await client.users.fetch(record.userId).catch(() => null);
			if (user && !user.bot) {
				joined.push(user);
				seenJoined.add(user.id);
			}
		}
	}
	return groups;
}

export async function getEventMaybeSignups(client: Client<true>, eventId: number) {
	const records = await db.events.getSignups(eventId);
	const maybe = records.filter((record) => record.status === 'MAYBE');
	const users = await Promise.all(
		maybe.map((record) => client.users.fetch(record.userId).catch(() => null))
	);
	return users.filter((user): user is User => Boolean(user && !user.bot));
}

async function send_alert(client: Client<true>, event: Event) {
	try {
		const guild = await client.guilds.fetch(event.guildId).catch(() => null);
		if (!guild) {
			logger.error(`Guild ${event.guildId} not found`);
			return;
		}

		const channel = await guild.channels.fetch(event.channelId).catch(() => null);

		if (!channel) {
			logger.error(`Channel ${event.channelId} not found in guild ${event.guildId}`);
			return;
		}

		if (!channel.isTextBased()) {
			logger.error(`Channel ${event.channelId} is not text based`);
			return;
		}

		const message = await channel.messages.fetch(event.messageId).catch(() => null);
		if (!message) {
			logger.error(`Message ${event.messageId} not found in channel ${event.channelId}`);
			return;
		}

		const groups = await getEventSignups(client, event);
		const mentions = groups.flatMap(({ users }) => users.map((u) => `<@${u.id}>`)).join(' ');

		if (!mentions) {
			logger.warn(`No human reactions for event ${event.id}, skipping alert`);
			return;
		}

		await channel.send({
			content: `${event.gameName} customs time! ${mentions}`,
			allowedMentions: { parse: ['users'] },
		});
	} catch (error) {
		logger.error(`Failed to send alert for event ${event.id}`, error);
	}
}

export enum EventStatus {
	OLDER_THAN_TIME_DISPARITY,
	WITHIN_TIME_DISPARITY,
	FUTURE,
}

export class EventManager {
	private static readonly TIME_DISPARITY_MS = 5 * 60 * 1000;
	// Last DB snapshot of upcoming events, re-read every cycle so dashboard edits and
	// deletions are honoured.
	private managed_events = new Map<number, Event>();
	// Events already alerted, so a failed DB cleanup can't ping everyone twice.
	private alerted_events = new Set<number>();
	private client: Client<true>;
	private is_processing = false;

	constructor(client: Client<true>) {
		this.client = client;
	}

	private getEventStatus(event: Event, time_now: number): EventStatus {
		const time_disparity = event.scheduledTime.getTime() - time_now;

		// If it's still in the future, categorize as FUTURE
		if (time_disparity > 0) return EventStatus.FUTURE;

		// If it's in the past:
		// WITHIN_TIME_DISPARITY = happened within the time disparity
		// OLDER_THAN_TIME_DISPARITY = happened more than the time disparity
		return time_disparity > -EventManager.TIME_DISPARITY_MS
			? EventStatus.WITHIN_TIME_DISPARITY
			: EventStatus.OLDER_THAN_TIME_DISPARITY;
	}

	private async deleteEvents(events: Event[]) {
		const ids = events.map((e) => e.id);
		if (ids.length === 0) return;

		await db.events.deleteEvents(ids);
		for (const id of ids) {
			this.managed_events.delete(id);
			this.alerted_events.delete(id);
		}
	}

	private async processEvents(events: Event[]) {
		const current_ids = new Set(events.map((event) => event.id));
		// Forget alerts for events that no longer exist in the DB.
		for (const id of this.alerted_events) if (!current_ids.has(id)) this.alerted_events.delete(id);

		const past_events: Event[] = [];
		const within_5_minutes: Event[] = [];
		const future_events: Event[] = [];

		const time_now = Date.now();
		for (const event of events) {
			const status = this.getEventStatus(event, time_now);
			switch (status) {
				case EventStatus.OLDER_THAN_TIME_DISPARITY:
					past_events.push(event);
					break;
				case EventStatus.WITHIN_TIME_DISPARITY:
					within_5_minutes.push(event);
					break;
				case EventStatus.FUTURE:
					future_events.push(event);
					break;
			}
		}

		const to_alert = within_5_minutes.filter((event) => !this.alerted_events.has(event.id));
		const added = future_events.filter((event) => !this.managed_events.has(event.id)).length;
		this.managed_events = new Map(future_events.map((event) => [event.id, event]));

		// Alert and wait for completions
		if (to_alert.length > 0) {
			for (const event of to_alert) this.alerted_events.add(event.id);
			await Promise.allSettled(to_alert.map((event) => send_alert(this.client, event)));
		}

		// Cleanup DB and memory
		await this.deleteEvents([...past_events, ...within_5_minutes]);

		const changes = {
			deleted: past_events.length + within_5_minutes.length,
			alerted: to_alert.length,
			added,
		};

		if (changes.deleted > 0 || changes.alerted > 0 || changes.added > 0) {
			logger.info(
				`Summary: ${changes.deleted} deleted, ${changes.alerted} alerted, ${changes.added} added`
			);
		}
	}

	async fetch_and_process_events() {
		if (this.is_processing) {
			logger.warn('Task already in progress, skipping interval');
			return;
		}

		this.is_processing = true;
		try {
			const events = await db.events.getEvents();
			await this.processEvents(events);
		} catch (error) {
			logger.error('Error during fetch and process cycle', error);
		} finally {
			this.is_processing = false;
		}
	}
}

export async function start_background_event_checker(client: Client<true>) {
	logger.info('Starting background event checker');
	const event_manager = new EventManager(client);
	const run = async () => {
		try {
			await event_manager.fetch_and_process_events();
		} catch (error) {
			logger.error('Background event check failed', error);
		}
	};

	// Schedule first so a failing initial run can't stop future checks.
	setInterval(() => void run(), 30000);
	await run();
}
