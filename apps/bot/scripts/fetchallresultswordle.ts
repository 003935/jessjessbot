import { REST, Routes } from 'discord.js';

import { Parse_Wordle_Message } from '@/modules/wordle.utils';
import { WinnersTable } from '@repo/database';
import { parseArgs } from 'util';
import { BOT_TOKEN, GUILD_ID, WORDLE_BOT_ID } from '@/environment';
import { exit } from 'process';
import { URLSearchParams } from 'url';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    channelId: {
      type: 'string'
    }
  },
  strict: true,
  allowPositionals: true
});

if (values.channelId === undefined) {
  throw new Error('Pass a Channel Id as argument');
}

async function main() {
  const rest = new REST().setToken(BOT_TOKEN);

  const limit = 100;

  const failed_mentions_to_user_id_map = new Map<string, string>();

  let fetched = 0;
  let messages_parsed_successfully = 0;

  const urlSearchParams = new URLSearchParams({ limit: limit.toString() });
  while (true) {
    const messages = (await rest.get(Routes.channelMessages(values.channelId!), {
      query: urlSearchParams
    })) as {
      id: string;
      content: string;
      timestamp: string;
      author: {
        id: string;
      };
    }[];
    fetched += messages.length;
    const userMessages = messages.filter((msg) => msg.author.id === WORDLE_BOT_ID);

    for (const message of userMessages) {
      const parsed = Parse_Wordle_Message(message.content);
      if (parsed === undefined) {
        continue;
      }

      const winner_ids = new Set<string>(parsed.winner_ids);

      if (parsed.failed_mentions.size > 0) {
        let successful_failed_mentions_parses = 0;
        for (const failed_mention of parsed.failed_mentions) {
          const cached_user_id = failed_mentions_to_user_id_map.get(failed_mention);
          if (cached_user_id !== undefined) {
            winner_ids.add(cached_user_id);
            successful_failed_mentions_parses += 1;
          } else {
            const users = (await rest.get(Routes.guildMembersSearch(GUILD_ID), {
              query: new URLSearchParams({ limit: '5', query: failed_mention })
            })) as {
              nick: string;
              user: {
                global_name: string;
                username: string;
                id: string;
              };
            }[];
            const user = users.filter((member) => {
              const nickname = member.nick || member.user.global_name || member.user.username;
              return nickname === failed_mention;
            })[0];

            if (user && !winner_ids.has(user.user.id)) {
              failed_mentions_to_user_id_map.set(failed_mention, user.user.id);
              winner_ids.add(user.user.id);
              successful_failed_mentions_parses += 1;
            }
          }
        }
        if (successful_failed_mentions_parses < parsed.failed_mentions.size) {
          console.error(
            `${message.id} | failed to parse mentions: \"${Array.from(parsed.failed_mentions).join('", "')}\"`
          );
        }
      }

      for (const winner_id of winner_ids) {
        const added = await WinnersTable.addWin(winner_id, message.id);
      }
      messages_parsed_successfully += 1;
    }

    console.log(
      `Messages fetched: ${fetched}, Parsed Successfully ${messages_parsed_successfully}`
    );
    const last_message = messages[messages.length - 1];
    if (last_message === undefined) {
      console.error(`messages.last() is undefined, messages.size: ${messages.length}`);
      exit(1);
    }
    urlSearchParams.set('before', last_message.id);
    if (messages.length < limit) {
      console.log('its joever');
      break;
    }
  }
}

main();
