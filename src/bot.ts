import { Client, Collection, Events, GatewayIntentBits, Guild, GuildMember, Message, MessageFlags, OmitPartialGroupDMChannel, Role, Snowflake, User } from 'discord.js'
import * as path from 'path';
import * as fs from 'fs';
import { WORDLE_BOT_ID, GUILD_ID, WORDLE_ROLE_ID } from './environment';
import { db } from './db';
import { winnersTable } from './db/schema';
import { eq } from 'drizzle-orm';
import { get_users_from_failed_mentions, Parse_Wordle_Message } from './wordle';

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

  const todays_date = new Date()
  todays_date.setUTCHours(0, 0, 0, 0);

  winners.forEach(async (W) => {
    await db.insert(winnersTable).values({
      date: todays_date,
      userID: W.id
    })
  })

  const winnerMentions = winners.map((winner) => `<@${winner.id}>`);
  if (winners_array.length === 1) {
    const totalWins = await db.$count(winnersTable, eq(winnersTable.userID, winners_array[0].id));
    await message.channel.send(`Congratulations ${winnerMentions[0]}! You are the new Wordle King! 👑 (Total wins: ${totalWins})`);
  } else {
    await message.channel.send(`Congratulations ${winnerMentions.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore}/6)`);
  }
});

client.login(process.env.BOT_TOKEN);

client.commands = new Collection();
// load commands from disk. historically the template put commands in subfolders
// (e.g. `commands/utility/ping.js`) but we may conceivably ship flat files too
// or have stray artifacts from a build process.  guard against non-directories so
// `readdirSync` doesn't try to `scandir` a file and blow up (which is what
// caused the ENOTDIR error above).
const foldersPath = path.join(__dirname, '..', 'commands');

// read with Dirent objects so we can filter directories only
let commandFolders: string[] = [];
try {
  commandFolders = fs.readdirSync(foldersPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
} catch (err) {
  console.error(`Unable to read commands directory at ${foldersPath}:`, err);
}

// in addition to subfolders make it possible to drop commands directly in
// `commands/` without a containing directory.  this mirrors the behaviour the
// template originally provided but keeps our loading logic safe.
for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  let commandFiles: string[] = [];
  try {
    commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
  } catch (err) {
    if (err && typeof err === 'object' && 'message' in err) {
      console.warn(`Skipping ${commandsPath}: not accessible (${(err as { message: string }).message})`);
    } else {
      console.warn(`Skipping ${commandsPath}: not accessible (unknown error)`);
    }
    continue;
  }

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(filePath);
    // ensure exports look like a discord command
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

// load any loose command files sitting directly in commands/
try {
  const rootFiles = fs.readdirSync(foldersPath).filter((file) => file.endsWith('.js'));
  for (const file of rootFiles) {
    const filePath = path.join(foldersPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
} catch (err) {
  // if the directory couldn't be read, we've already logged above, no need
  // to duplicate the message.
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
