import { Client, User } from "discord.js";
import { EventsTable, type Event } from "@/db/event";

async function send_alert(client: Client<true>, event: Event) {
  try {
    const guild = await client.guilds.fetch(event.guildId);
    const channel = await guild.channels.fetch(event.channelId);

    if (!channel) {
      EventManager.error(`Channel ${event.channelId} not found in guild ${event.guildId}`);
      return;
    }

    if (!channel.isTextBased()) {
      EventManager.error(`Channel ${event.channelId} is not text based`);
      return;
    }

    const message = await channel.messages.fetch(event.messageId).catch(() => null);
    if (!message) {
      EventManager.error(`Message ${event.messageId} not found in channel ${event.channelId}`);
      return;
    }

    const reaction = message.reactions.resolve("✅");

    if (!reaction) {
      EventManager.error(`Checkmark reaction not found on message ${event.messageId}`);
      return;
    }

    const users = await reaction.users.fetch();

    const mentions = users
      .filter((u: User) => !u.bot)
      .map((u: User) => `<@${u.id}>`)
      .join(" ");

    if (!mentions) {
      EventManager.warn(`No human reactions for event ${event.id}, skipping alert`);
      return;
    }

    await channel.send({
      content: `${event.game} customs time! ${mentions}`,
      allowedMentions: { parse: ["users"] },
    });
  } catch (error) {
    EventManager.error(`Failed to send alert for event ${event.id}:`, error);
  }
}

export enum EventStatus {
  OLDER_THAN_TIME_DISPARITY,
  WITHIN_TIME_DISPARITY,
  FUTURE,
}

export class EventManager {
  private static readonly LOG_PREFIX = "[Event Manager]";
  private static readonly TIME_DISPARITY_MS = 5 * 60 * 1000;
  private managed_events = new Map<number, Event>();
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

    await EventsTable.deleteEvents(ids);
    for (const id of ids) {
      this.managed_events.delete(id);
    }
  }

  private async processEvents(new_events: Event[]) {
    const events = [...this.managed_events.values(), ...new_events];

    const past_events: Event[] = [];
    const within_5_minutes: Event[] = [];
    const new_future_events: Event[] = [];

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
          if (!this.managed_events.has(event.id))
            new_future_events.push(event);
          break;
      }
    }

    // Alert and wait for completions
    if (within_5_minutes.length > 0) {
      await Promise.allSettled(within_5_minutes.map((event) => send_alert(this.client, event)));
    }

    // Cleanup DB and memory
    await this.deleteEvents([...past_events, ...within_5_minutes]);

    // Track new future events
    new_future_events.forEach((event) => this.managed_events.set(event.id, event));

    const changes = {
      deleted: past_events.length + within_5_minutes.length,
      alerted: within_5_minutes.length,
      added: new_future_events.length,
    };

    if (changes.deleted > 0 || changes.alerted > 0 || changes.added > 0) {
      EventManager.log(
        `Summary: ${changes.deleted} deleted, ${changes.alerted} alerted, ${changes.added} added`
      );
    }
  }

  async fetch_and_process_events() {
    if (this.is_processing) {
      EventManager.warn("Task already in progress, skipping interval");
      return;
    }

    this.is_processing = true;
    try {
      const events = await EventsTable.getEvents(Array.from(this.managed_events.keys()));
      await this.processEvents(events);
    } catch (error) {
      EventManager.error("Error during fetch and process cycle:", error);
    } finally {
      this.is_processing = false;
    }
  }

  static log(...data: any[]) {
    console.log(EventManager.LOG_PREFIX, ...data);
  }

  static warn(...data: any[]) {
    console.warn(EventManager.LOG_PREFIX, ...data);
  }

  static error(...data: any[]) {
    console.error(EventManager.LOG_PREFIX, ...data);
  }
}

export async function start_background_event_checker(client: Client<true>) {
  EventManager.log("Starting background event checker");
  const event_manager = new EventManager(client);

  // Initial run
  await event_manager.fetch_and_process_events();

  setInterval(async () => {
    await event_manager.fetch_and_process_events();
  }, 30000);
}
