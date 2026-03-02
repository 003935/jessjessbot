import { Collection, Events, GatewayIntentBits, Guild, GuildMember, Message, MessageFlags, OmitPartialGroupDMChannel, Role, Snowflake, User } from 'discord.js'
import * as path from 'path';
import * as fs from 'fs';
import { WORDLE_BOT_ID, GUILD_ID, WORDLE_ROLE_ID } from './environment';
import { db } from './db';
import { winnersTable } from './db/schema';
import { eq } from 'drizzle-orm';
import { get_users_from_failed_mentions, Parse_Wordle_Message } from './wordle';
import { SapphireClient } from '@sapphire/framework';

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  loadMessageCommandListeners: true
});


async function add_roles(wordleKingRole: Role, guild: Guild, winners: Array<User>) {
  console.log(`Adding role to ${winners.map((w) => w.displayName).join(', ')}.`);
  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const winnerMember = await guild.members.fetch(winner.id);
    await winnerMember.roles.add(wordleKingRole);
  }
}

async function remove_roles(wordleKingRole: Role, guild: Guild, users: Collection<Snowflake, GuildMember>) {

  const members = users.size > 0 ? users : await guild.members.fetch();

  const membersWithRole = members.filter(member => member.roles.cache.has(wordleKingRole.id));

  console.log(`Removing role from ${membersWithRole.map((m) => m.displayName).join(', ')}.`);

  for (const [, member] of membersWithRole) {
    await member.roles.remove(wordleKingRole);
  }
}


client.on('clientReady', (client) => {
  console.log(`${client.user?.tag} is online!`);
});

client.on('messageCreate', async (message) => {
  const guild = message.guild;

  if (guild === null) return; // Ignore DMs
  if (guild.id !== GUILD_ID) return; // Ignore other guilds
  if (message.author.id !== WORDLE_BOT_ID) return; // Ignore non-Wordle bot messages


  console.log('📨 Message received:', message.content);

  const parse_result = await Parse_Wordle_Message(message);
  if (parse_result === undefined) {
    console.log('No valid Wordle result found in the message.');
    return;
  }

  const members: Collection<Snowflake, GuildMember> = await guild.members.fetch();
  await new Promise(resolve => setTimeout(resolve, 30000));

  const winners = new Collection<string, User>(parse_result.winners.map((user) => [user.id, user]))
  if (parse_result.failed_mentions.size > 0) {
    const parsed_failed = get_users_from_failed_mentions(parse_result.failed_mentions, members)

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


  const { winningScore } = parse_result;

  const wordleKingRole = await guild.roles.fetch(WORDLE_ROLE_ID);
  console.log(`Fetched role: ${wordleKingRole?.name}`);
  if (wordleKingRole === null) {
    console.error(`Role with ID ${WORDLE_ROLE_ID} not found in guild ${guild.name}.`);
    return;
  };


  const winners_array = Array.from(winners.values());
  await new Promise(resolve => setTimeout(resolve, 30000));
  await remove_roles(wordleKingRole, guild, members) // Remove role from previous kings
  console.log(`Previous Wordle Kings removed.`);
  await add_roles(wordleKingRole, guild, winners_array) // Add role to new kings
  console.log(`New Wordle Kings assigned.`);

  winners.forEach(async (winner) => {
    const users = await db.select().from(winnersTable).where(eq(winnersTable.userID, winner.id));
    const user = users.length > 0 ? users[0] : null
    if (user === null) {
      await db.insert(winnersTable).values({ userID: winner.id, wins: 1 });
    } else {
      await db.update(winnersTable).set({ wins: user.wins + 1 }).where(eq(winnersTable.userID, user.userID));
    }
  })

  const winnerMentions = winners.map((winner) => `<@${winner.id}>`);
  if (winners_array.length === 1) {
    const users = await db.select().from(winnersTable).where(eq(winnersTable.userID, winners_array[0].id))
    const user = users.length > 0 ? users[0] : null
    await message.channel.send(`Congratulations ${winnerMentions[0]}! You are the new Wordle King! 👑 (Total wins: ${user?.wins})`);
  } else {
    await message.channel.send(`Congratulations ${winnerMentions.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore}/6)`);
  }
});

client.login(process.env.BOT_TOKEN);
