import { Client, Collection, Events, GatewayIntentBits, Guild, Message, MessageFlags, OmitPartialGroupDMChannel, Role, User } from 'discord.js'
import { getStatsManager, persistStats } from './stats';
import * as path from 'path';
import * as fs from 'fs';
const BOT_NAME = 'jessjessbot';
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

  const WORDLE_KING_ROLE_NAME = 'Wordle King';
  const WORDLE_BOT_ID = process.env.BOT_ID;
  const WORDLE_ROLE_ID = process.env.ROLE_ID;

  if (WORDLE_BOT_ID === undefined) throw new Error('BOT ID NOT DEFINED');
  if (WORDLE_ROLE_ID === undefined) throw new Error('ROLE ID NOT DEFINED');

  async function add_roles (wordleKingRole:Role, guild:Guild, winners:Array<User>) {
    for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        const winnerMember = await guild.members.fetch(winner.id);
        await winnerMember.roles.add(wordleKingRole);
    }
    
  }

  async function remove_roles (wordleKingRole:Role, guild:Guild) {

    const membersWithRole = guild.members.cache.filter(member => 
        member.roles.cache.has(wordleKingRole.id)
      );
      
      for (const [, member] of membersWithRole) {
        await member.roles.remove(wordleKingRole);
      }
  }

  async function winner_mentions (winners:Array<User>) : Promise<Array<string>> {
    const winnerNames:Array<string> = [];
    for (const winner of winners) {
      winnerNames.push(`<@${winner.id}>`);
    }
    return winnerNames;
  }

  async function Parse_Wordle_Message (message:OmitPartialGroupDMChannel<Message<boolean>>) : Promise<{winners:User[], winningScore:string} | undefined> {
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
    
    const winners:Array<User>= [];
    message.mentions.users.forEach(user => {
      const position = afterCrown.indexOf(`<@${user.id}>`);
      if (position !== -1) winners.push(user);
    });
    
    if (winners.length === 0) return;
    
    return {winners, winningScore};

  }

  client.on('clientReady', () => {
    console.log(`${BOT_NAME} is online!`);
    console.log(`Logged in as ${client?.user?.tag}`);
  });
  
  client.on('messageCreate', async (message) => {
    console.log('📨 Message received:', message.content);
    
    const parse_result = await Parse_Wordle_Message(message);
    if (parse_result === undefined) 
    return;

    const {winners, winningScore} = parse_result;

    const guild = message.guild;
    if (guild === null) return;
    const wordleKingRole = guild.roles.cache.get(WORDLE_ROLE_ID);
    if (!wordleKingRole) return;
    

    remove_roles(wordleKingRole, guild)
    add_roles(wordleKingRole, guild, winners)

    const winnerNames = await winner_mentions(winners)
    const statManager = getStatsManager()

    
    statManager.addWinToUsers(winners.map((winner)=>winner.id))
  
    persistStats(statManager)
    

    if (winners.length === 1) {
      const totalWins = statManager.getUserStats(winners[0].id).wins;
    
      await message.channel.send(`Congratulations ${winnerNames[0]}! You are the new Wordle King! 👑 (Total wins: ${totalWins})`);
    } else {
      await message.channel.send(`Congratulations ${winnerNames.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore}/6)`);
    }
  });
  
  client.login(process.env.BOT_TOKEN);

  client.commands = new Collection();
const foldersPath = path.join(__dirname,"..",'commands');
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