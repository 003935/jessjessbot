import { Client, Collection, Events, GatewayIntentBits, Guild, GuildMember, Message, MessageFlags, OmitPartialGroupDMChannel, Role, User } from 'discord.js'
import { getStatsManager, persistStats } from './stats';
import * as path from 'path';
import * as fs from 'fs';
import { WORDLE_BOT_ID, GUILD_ID, WORDLE_ROLE_ID } from './environment';

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


async function add_roles(wordleKingRole: Role, guild: Guild, winners: Array<User>) {
  console.log(`Adding role to ${winners.map((w) => w.displayName).join(', ')}.`);
  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const winnerMember = await guild.members.fetch(winner.id);
    await winnerMember.roles.add(wordleKingRole);
  }
}

async function remove_roles(wordleKingRole: Role, guild: Guild) {

  const members = await guild.members.fetch();

  const membersWithRole = members.filter(member => member.roles.cache.has(wordleKingRole.id));

  console.log(`Removing role from ${membersWithRole.map((m) => m.displayName).join(', ')}.`);

  for (const [, member] of membersWithRole) {
    await member.roles.remove(wordleKingRole);
  }
}

async function Parse_Wordle_Message(message: OmitPartialGroupDMChannel<Message<boolean>>): Promise<{ winners: User[], winningScore: string } | undefined> {
  if (message.author.id !== WORDLE_BOT_ID) return;
  if (!message.content.includes("Here are yesterday's results:")) return;

  const lines = message.content.split('\n');
  const crownLine = lines.find(line => line.includes('👑'));

  if (!crownLine) return;

  const scoreMatch = crownLine.match(/(\d+)\/6/);
  if (!scoreMatch) return;

  const winningScore = scoreMatch[1];
  const crownIndex = crownLine.indexOf('👑');
  const afterCrown = crownLine.substring(crownIndex);

  const winners: Array<User> = [];
  message.mentions.users.forEach(user => {
    const position = afterCrown.indexOf(`<@${user.id}>`);
    if (position !== -1) winners.push(user);
  });

  const failed_mentions = new Set<string>();
  let starting_index = -1

  for (let i = 1; i < afterCrown.length; i++) {
    const letter = afterCrown[i];
    if (letter === '@' && afterCrown[i-1] === ' ') {
      if (starting_index === -1)
        starting_index = i 
      else {
        failed_mentions.add(afterCrown.slice(starting_index + 1, i).trim())
        starting_index = -1
      }
    }
    else if (letter === '<' && starting_index !== -1) {
        failed_mentions.add(afterCrown.slice(starting_index + 1, i).trim())
        starting_index = -1
      }
  }
  if (starting_index !== -1) {
    failed_mentions.add(afterCrown.slice(starting_index + 1, afterCrown.length).trim())
  }

  if (failed_mentions.size > 0 && message.guild !== null) {
    const members = Array.from((await message.guild.members.fetch()).values())
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (failed_mentions.has(member.displayName)) {
        winners.push(member.user as User)
        failed_mentions.delete(member.displayName)
      }
      
    }
  }

  console.log(failed_mentions);

  if (winners.length === 0) return;

  return { winners, winningScore };

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
  const { winners, winningScore } = parse_result;

  const wordleKingRole = await guild.roles.fetch(WORDLE_ROLE_ID);
  if (wordleKingRole === null) {
    console.error(`Role with ID ${WORDLE_ROLE_ID} not found in guild ${guild.name}.`);
    return;
  };

  await remove_roles(wordleKingRole, guild) // Remove role from previous kings
  await add_roles(wordleKingRole, guild, winners) // Add role to new kings

  const statManager = getStatsManager()
  statManager.addWinToUsers(winners.map((winner) => winner.id))
  persistStats(statManager)

  const winnerMentions = winners.map((winner) => `<@${winner.id}>`);
  if (winners.length === 1) {
    const totalWins = statManager.getUserStats(winners[0].id).wins;
    await message.channel.send(`Congratulations ${winnerMentions[0]}! You are the new Wordle King! 👑 (Total wins: ${totalWins})`);
  } else {
    await message.channel.send(`Congratulations ${winnerMentions.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore}/6)`);
  }
});

client.login(process.env.BOT_TOKEN);

client.commands = new Collection();
const foldersPath = path.join(__dirname, "..", 'commands');
const commandFolders = fs.readdirSync(foldersPath);
for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = (interaction.client as ClientWithCommands).commands.get(interaction.commandName);
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});
