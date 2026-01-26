require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const BOT_NAME = 'jessjessbot';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const WORDLE_KING_ROLE_NAME = 'Wordle King';
const WORDLE_BOT_ID = '1211781489931452447'; // The Wordle app bot

client.on('ready', () => {
  console.log(`${BOT_NAME} is online!`);
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Only process messages from the Wordle bot
  if (message.author.id !== WORDLE_BOT_ID) return;
  
  // Check if message contains "Here are yesterday's results:"
  if (!message.content.includes("Here are yesterday's results:")) return;
  
  console.log('Wordle results detected!');
  
  // Find the line with the crown emoji (👑)
  const lines = message.content.split('\n');
  const crownLine = lines.find(line => line.includes('👑'));
  
  if (!crownLine) {
    console.log('No crown found in message');
    return;
  }
  
  // Extract mentions after the crown
  const crownIndex = crownLine.indexOf('👑');
  const afterCrown = crownLine.substring(crownIndex);
  
  // Get all user mentions
  const mentions = message.mentions.users;
  
  if (mentions.size === 0) {
    console.log('No users mentioned');
    return;
  }
  
  // The winner is the first user mentioned in the crown line
  // Parse the line to find which user comes first after the crown
  let winner = null;
  let earliestPosition = Infinity;
  
  mentions.forEach(user => {
    const position = afterCrown.indexOf(`<@${user.id}>`);
    if (position !== -1 && position < earliestPosition) {
      earliestPosition = position;
      winner = user;
    }
  });
  
  if (!winner) {
    console.log('Could not determine winner');
    return;
  }
  
  console.log(`Winner: ${winner.tag}`);
  
  // Get the guild and role
  const guild = message.guild;
  const wordleKingRole = guild.roles.cache.get('1228242296366174320');

  if (!wordleKingRole) {
    console.log('Wordle King role not found! Please create it first.');
    return;
  }
  
  // Remove role from everyone who has it
  const membersWithRole = guild.members.cache.filter(member => 
    member.roles.cache.has(wordleKingRole.id)
  );
  
  for (const [, member] of membersWithRole) {
    await member.roles.remove(wordleKingRole);
    console.log(`Removed Wordle King from ${member.user.tag}`);
  }
  
  // Add role to winner
  const winnerMember = await guild.members.fetch(winner.id);
  await winnerMember.roles.add(wordleKingRole);
  console.log(`Added Wordle King to ${winner.tag}`);
  
  // Optional: Send a congratulations message
  await message.channel.send(`Congratulations <@${winner.id}>! You are the new Wordle King! 👑`);
});

// Login with your bot token
client.login(process.env.BOT_TOKEN);