import { Client, Collection, Events, GatewayIntentBits, Guild, GuildMember, Message, MessageFlags, OmitPartialGroupDMChannel, Role, Snowflake, User } from 'discord.js'

import { WORDLE_BOT_ID, GUILD_ID, WORDLE_ROLE_ID } from '../src/environment';
import { db } from '../src/db';
import { winnersTable } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { get_users_from_failed_mentions, Parse_Wordle_Message } from '../src/wordle';

interface ClientWithCommands extends Client {
    commands: Collection<string, any>
}
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
}) as ClientWithCommands;

const Wordle_bot_ID = process.env.BOT_ID!
client.on('clientReady', async (client) => {
    console.log(`${client.user?.tag} is online!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID!)
    const channel = await guild.channels.fetch(process.env.CHANNEL_ID!)
    if (!channel || !channel.isTextBased()) {
        console.log(123)
        return
    };
    let last_message_id: string | null = null
    const limit = 100;

    console.log("fetching members...")
    let members: Collection<Snowflake, GuildMember> = await guild.members.fetch();
    await new Promise(resolve => setTimeout(resolve, 30000));

    while (true) {
        console.log("fetching messages...")
        const messages: Collection<Snowflake, Message> = await channel.messages.fetch({ limit, before: last_message_id === null ? undefined : last_message_id });
        const userMessages = messages.filter(msg => msg.author.id === Wordle_bot_ID);
        for (const [_, message] of userMessages) {
            const parsed = Parse_Wordle_Message(message)
            if (parsed === undefined) {
                console.log("message not parsed correctly")
                continue
            }
            const winners = new Collection<string, User>(parsed.winners.map((user) => [user.id, user]))
            if (parsed.failed_mentions.size > 0) {
                const parsed_failed = get_users_from_failed_mentions(parsed.failed_mentions, members)

                if (parsed_failed.failed_mentions.size > 0) {
                    console.log("failed to parse some mentions in message: " + message.id)
                    console.log(parsed_failed.failed_mentions)
                }
                parsed_failed.winners.forEach((winner) => {
                    if (!winners.has(winner.id)) {
                        winners.set(winner.id, winner)
                    }
                })
            }

            const message_date = message.createdAt
            message_date.setUTCHours(0, 0, 0, 0);

            try {
                await db.insert(winnersTable).values(winners.map((U) => {
                    return {
                        date: message_date, userID: U.id
                    }
                }))
            }
            catch (e) {
                console.log("message already exists in database")
            }
        }
        const last_message = messages.last();
        if (last_message === undefined) {
            console.log(messages.size)
            return
        }
        last_message_id = last_message.id
        if (messages.size < limit) {
            console.log("its joever")
            break
        }
        console.log("waiting 20 seconds before fetching more messages...")
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    client.destroy();
});

client.login(process.env.BOT_TOKEN);

