import { Client } from "discord.js";
import { EventsTable, Event } from "../db/event";

async function send_alert(client: Client<true>, event: Event) {
  console.log(`Sending alert for event ${event.id}`);
  const guild = await client.guilds.fetch(event.guildId);
  console.log(`Fetched guild ${event.guildId}`);
  const channel = await guild.channels.fetch(event.channelId);
  if (channel === null) {
    console.error("Failed to fetch channel, id:", event.channelId);
    return;
  }

  if (!channel.isTextBased()) {
    console.error("Channel is not text based, id:", event.channelId);
    return;
  }
  console.log(`Fetched text channel ${event.channelId}`);

  const message = await channel.messages.fetch(event.messageId);
  console.log(`Fetched message ${event.messageId}`);
  const reaction = message.reactions.resolve("✅");

  if (reaction === null) {
    console.error("Failed to fetch reaction, messageId:", event.messageId);
    return;
  }
  console.log("Fetched reaction");

  const users = await reaction.users.fetch();
  console.log(`Fetched ${users.size} users from reaction`);

  const mentions = users
    ?.filter((u: any) => !u.bot)
    .map((u: any) => `<@${u.id}>`)
    .join(" ");

  console.log(`Mentions: ${mentions}`);
  if (!mentions) {
    console.log("No mentions, skipping send");
    return;
  }

  await channel.send({
    content: ` ${event.game} customs time! ${mentions}`,
    allowedMentions: { parse: ["users"] },
  });
  console.log("Sent alert message");
}

export async function start_background_event_checker(client: Client<true>) {
  console.log("Starting background event checker");
  const event_map = new Map<number, Event>();
  const get_past_events = EventsTable.getPastEvents();
  const get_future_events = EventsTable.getFutureEvents();

  const past_event_ids = (await get_past_events).map((pe) => pe.id);
  console.log(`Found ${past_event_ids.length} past events to delete`);
  EventsTable.deleteEvents(past_event_ids);

  const future_events = await get_future_events;
  console.log(`Loaded ${future_events.length} future events into map`);
  for (const fe of future_events) {
    event_map.set(fe.id, fe);
  }

  setInterval(async () => {
    console.log("Event checker interval running");
    const time_now = new Date().getTime();
    console.log(`Current time: ${new Date(time_now).toISOString()}`);
    const past_events = Array.from(event_map.values()).filter(
      (e) => e.scheduledTime.getTime() < time_now,
    );
    console.log(`Found ${past_events.length} past events`);
    if (past_events.length > 0) {
      //delete past events from map
      for (const pe of past_events) event_map.delete(pe.id);
      console.log("Deleted past events from map");

      let promises = new Array<Promise<void>>();

      //delete past events from db
      const delete_ids = past_events.map((pe) => pe.id);
      console.log(`Deleting events from DB: ${delete_ids}`);
      promises.push(EventsTable.deleteEvents(delete_ids));

      //send alert messages
      for (const pe of past_events) {
        console.log(
          `Sending alert for event ${pe.id}: ${pe.game} at ${pe.scheduledTime}`,
        );
        promises.push(send_alert(client, pe));
      }

      const results = await Promise.allSettled(promises);
      console.log(
        "Promise results:",
        results.map((r) => r.status),
      );
    } else {
      console.log("No Past Events");
    }

    const future_events = await EventsTable.getFutureEvents();
    console.log(`Fetched ${future_events.length} future events from DB`);

    for (const fe of future_events) {
      if (event_map.has(fe.id)) continue;
      console.log(`Adding new future event ${fe.id} to map`);
      event_map.set(fe.id, fe);
    }
    console.log(`Event map now has ${event_map.size} events`);
  }, 30000);
}
