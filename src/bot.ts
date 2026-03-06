import { GatewayIntentBits, GuildMember, Role } from 'discord.js';
import { WORDLE_BOT_ID, GUILD_ID, WORDLE_ROLE_ID, BOT_TOKEN } from './environment';
import { Parse_Wordle_Message } from './wordle';
import { SapphireClient } from '@sapphire/framework';
import { WinnersTable } from './db/wordle';

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  loadMessageCommandListeners: true
});


async function sync_wordle_role(winners: Array<GuildMember>, role: Role) {
  const consecutive_winners = new Map<string, GuildMember>(winners.filter((winner) => role.members.has(winner.id)).map((member) => [member.id, member]))

  const to_remove = (Array.from(role.members.values())).filter((member) => !consecutive_winners.has(member.id))
  const to_add = winners.filter((member) => !consecutive_winners.has(member.id))

  if (to_remove.length > 0) console.log(`Removing role from ${to_remove.map((m) => m.displayName).join(", ")}.`)
  if (to_add.length > 0) console.log(`Adding role to ${to_add.map((m) => m.displayName).join(", ")}.`)
  if (consecutive_winners.size > 0) console.log(`Keeping role on ${Array.from(consecutive_winners.values()).map((m) => m.displayName).join(", ")}.`)

  for (const member of to_remove) await member.roles.remove(role);
  for (const member of to_add) await member.roles.add(role);
}


client.on('clientReady', (client) => {
  console.log(`${client.user?.tag} is online!`);
});

client.on('messageCreate', async (message) => {
  if (!message.inGuild()) return;
  const guild = message.guild;
  if (guild.id !== GUILD_ID) return; // Ignore other guilds
  if (message.author.id !== WORDLE_BOT_ID) return; // Ignore non-Wordle bot messages

  console.log(`📨 Message received:
   \t${message.content.split("\n").join("\n\t")}`);

  const parse_result = Parse_Wordle_Message(message);
  if (parse_result === undefined) {
    console.log('No valid Wordle result found in the message.');
    return;
  }

  const winners = Array.from(parse_result.winners)

  if (parse_result.failed_mentions.size > 0) {
    for (const failed_mention of parse_result.failed_mentions) {
      const users = await guild.members.fetch({ query: failed_mention, limit: 1 })
      const user = users.filter((member) => member.displayName === failed_mention).first()
      if (user) {
        winners.push(user);
        console.log(`Parsed failed mention: ${failed_mention} -> ${user.displayName} (@${user.user.tag})`);
      } else {
        console.warn(`No user found for failed mention: ${failed_mention}`);
      }
    }
  }

  const { winningScore } = parse_result;

  const wordleKingRole = await guild.roles.fetch(WORDLE_ROLE_ID);
  if (wordleKingRole === null) {
    console.error(`Role with ID ${WORDLE_ROLE_ID} not found in guild ${guild.name}.`);
    return;
  };

  await sync_wordle_role(winners, wordleKingRole)

  winners.forEach(async (winner) => {
    await WinnersTable.incrementWins(winner.id)
  })

  const winnerMentions = winners.map((winner) => `<@${winner.id}>`);
  if (winners.length === 1) {
    const dbUser = await WinnersTable.getUser(winners[0].id)
    await message.channel.send(`Congratulations ${winnerMentions[0]}! You are the new Wordle King! 👑 (Total wins: ${dbUser?.wins ?? 0})`);
  } else {
    await message.channel.send(`Congratulations ${winnerMentions.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore}/6)`);
  }
});

client.login(BOT_TOKEN);
