import { Collection, GatewayIntentBits, Message } from 'discord.js';

import { Parse_Wordle_Message } from '../src/wordle';
import { WinnersTable } from '../src/db/wordle';
import { SapphireClient } from '@sapphire/framework';
import { parseArgs } from "util";
import { BOT_TOKEN, GUILD_ID, WORDLE_BOT_ID } from '../src/environment';
import { exit } from 'process';

const { values } = parseArgs({
    args: Bun.argv,
    options: {
        channelId: {
            type: "string",
        },
    },
    strict: true,
    allowPositionals: true
});

if (values.channelId === undefined) {
    throw new Error("Pass a Channel Id as argument")
}

const client = new SapphireClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.on('clientReady', async (client) => {
    console.log(`${client.user?.tag} is online!`);

    const guild = await client.guilds.fetch(GUILD_ID)
    const channel = await guild.channels.fetch(values.channelId!)

    if (!channel || !channel.isTextBased()) {
        console.error("Channel is not appropriate")
        exit(1)
    };

    let last_message_id: string | null = null
    const limit = 100;

    const failed_mentions_to_user_id_map = new Map<string, string>()

    let fetched = 0;
    let messages_parsed_successfully = 0;
    while (true) {
        const messages: Collection<string, Message<true>> = await channel.messages.fetch({ limit, before: last_message_id === null ? undefined : last_message_id });
        fetched += messages.size;
        const userMessages = messages.filter(msg => msg.author.id === WORDLE_BOT_ID);
        for (const [_, message] of userMessages) {
            const parsed = Parse_Wordle_Message(message)
            if (parsed === undefined) {
                continue
            }

            const winner_ids = new Set(parsed.winners.map((m) => m.id))

            if (parsed.failed_mentions.size > 0) {
                let successful_failed_mentions_parses = 0;
                for (const failed_mention of parsed.failed_mentions) {
                    const cached_user_id = failed_mentions_to_user_id_map.get(failed_mention)
                    if (cached_user_id) {
                        winner_ids.add(cached_user_id)
                        successful_failed_mentions_parses += 1
                    } else {
                        const users = await guild.members.fetch({ query: failed_mention, limit: 1 })
                        const user = users.filter((member) => member.displayName === failed_mention).first()
                        if (user && !winner_ids.has(user.id)) {
                            failed_mentions_to_user_id_map.set(failed_mention, user.id)
                            winner_ids.add(user.id)
                            successful_failed_mentions_parses += 1
                        }
                    }

                }
                if (successful_failed_mentions_parses < parsed.failed_mentions.size) {
                    console.error("failed to parse some failed mentions in message: " + message.id)
                }
            }

            for (const winner_id of winner_ids) {
                await WinnersTable.incrementWins(winner_id)
            }
            messages_parsed_successfully += 1
        }
        console.log(`Messages fetched: ${fetched}, Parsed Successfully ${messages_parsed_successfully}`)
        const last_message = messages.last();
        if (last_message === undefined) {
            console.error(`messages.last() is undefined, messages.size: ${messages.size}`)
            exit(1)
        }
        last_message_id = last_message.id
        if (messages.size < limit) {
            console.log("its joever")
            break
        }
    }
    client.destroy();
});

WinnersTable.size().then((size) => {
    const is_winners_table_empty = size === 0
    if (!is_winners_table_empty) {
        console.error("Winners table is not empty")
        exit(1)
    }
    client.login(BOT_TOKEN);
})

