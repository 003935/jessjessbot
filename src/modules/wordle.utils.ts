import { Collection, GuildMember, Message, Snowflake } from "discord.js";

export function Parse_Wordle_Message(
  message: string,
):
  | {
      winner_ids: Set<string>;
      failed_mentions: Set<string>;
      winningScore: string;
    }
  | undefined {
  if (!message.includes("Here are yesterday's results:")) return;

  const lines = message.split("\n");
  const crownLine = lines.find((line) => line.includes("👑"));

  if (!crownLine) return;

  const scoreMatch = crownLine.match(/(\d+)\/6/);
  if (!scoreMatch) return;

  const winningScore = scoreMatch[1];
  const crownIndex = crownLine.indexOf("👑");
  const afterCrown = crownLine.substring(crownIndex);

  const winner_ids = new Set(
    [...afterCrown.matchAll(/<@!?(\d+)>/g)].map((match) => match[1]),
  );

  const failed_mentions = new Set<string>();
  let starting_index = -1;

  for (let i = 1; i < afterCrown.length; i++) {
    const letter = afterCrown[i];
    if (letter === "@" && afterCrown[i - 1] === " ") {
      if (starting_index === -1) starting_index = i;
      else {
        failed_mentions.add(afterCrown.slice(starting_index + 1, i).trim());
        starting_index = -1;
      }
    } else if (letter === "<" && starting_index !== -1) {
      failed_mentions.add(afterCrown.slice(starting_index + 1, i).trim());
      starting_index = -1;
    }
  }
  if (starting_index !== -1) {
    failed_mentions.add(
      afterCrown.slice(starting_index + 1, afterCrown.length).trim(),
    );
  }

  return { winner_ids, winningScore, failed_mentions };
}

export function get_users_from_failed_mentions(
  failed_mentions: Set<string>,
  users: Collection<Snowflake, GuildMember>,
): { winners: GuildMember[]; failed_mentions: Set<string> } {
  const winners = new Array<GuildMember>();
  const members = Array.from(users.values());
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (failed_mentions.has(member.displayName)) {
      winners.push(member);
      failed_mentions.delete(member.displayName);
    }
  }

  return {
    winners,
    failed_mentions,
  };
}
