if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
  const { Client, GatewayIntentBits } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  
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
  
  // File to store win counts
  const STATS_FILE = path.join(__dirname, 'wordle_stats.json');
  
  // Load or initialize stats
  function loadStats() {
    try {
      if (fs.existsSync(STATS_FILE)) {
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
    return {};
  }
  
  function saveStats(stats) {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }
  
  let wordleStats = loadStats();
  
  client.on('clientReady', () => {
    console.log(`${BOT_NAME} is online!`);
    console.log(`Logged in as ${client.user.tag}`);
  });
  
  client.on('messageCreate', async (message) => {
     // Debug logging
  console.log('📨 Message received:', message.content);
  console.log('👤 From:', message.author.tag);
  console.log('🤖 Is bot?:', message.author.bot);
    // Handle stats command
    if (message.content.toLowerCase() === '!wordlestats' || message.content.toLowerCase() === '!kings') {
      const sortedStats = Object.entries(wordleStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10
  
      if (sortedStats.length === 0) {
        await message.channel.send('No Wordle King wins recorded yet! 👑');
        return;
      }
  
      let leaderboard = '**👑 Wordle King Leaderboard 👑**\n\n';
      sortedStats.forEach(([userId, wins], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        leaderboard += `${medal} <@${userId}>: **${wins}** wins\n`;
      });
  
      await message.channel.send(leaderboard);
      return;
    }
  
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
    
    console.log('Crown line:', crownLine);
    
    // Extract the score (e.g., "3/6")
    const scoreMatch = crownLine.match(/(\d+)\/6/);
    if (!scoreMatch) {
      console.log('Could not find score in crown line');
      return;
    }
    
    const winningScore = scoreMatch[1];
    console.log('Winning score:', winningScore);
    
    // Get all user mentions from the crown line
    const crownIndex = crownLine.indexOf('👑');
    const afterCrown = crownLine.substring(crownIndex);
    
    // Find all winners (everyone mentioned after the crown on that line)
    const winners = [];
    const mentions = message.mentions.users;
    
    mentions.forEach(user => {
      const position = afterCrown.indexOf(`<@${user.id}>`);
      if (position !== -1) {
        winners.push(user);
      }
    });
    
    if (winners.length === 0) {
      console.log('No winners found');
      return;
    }
    
    console.log(`Winners (${winners.length}):`, winners.map(w => w.tag).join(', '));
    
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
    
    // Add role to all winners and update stats
    const winnerNames = [];
    for (const winner of winners) {
      // Update stats
      if (!wordleStats[winner.id]) {
        wordleStats[winner.id] = 0;
      }
      wordleStats[winner.id]++;
      console.log(`Updated stats: ${winner.tag} now has ${wordleStats[winner.id]} wins`);
      
      // Add role
      const winnerMember = await guild.members.fetch(winner.id);
      await winnerMember.roles.add(wordleKingRole);
      console.log(`Added Wordle King to ${winner.tag}`);
      
      winnerNames.push(`<@${winner.id}>`);
    }
    
    // Save stats
    saveStats(wordleStats);
    
    // Send congratulations message
    if (winners.length === 1) {
      const totalWins = wordleStats[winners[0].id];
      await message.channel.send(`YAAAYYY YIPPPIE ${winnerNames[0]}! You are the new Wordle King!  (Total wins: ${totalWins})`);
    } else {
      await message.channel.send(`YAAAYYY YIPPPIE ${winnerNames.join(', ')}! You are the new Wordle Kings! (Tied with ${winningScore}/6)`);
    }
  });
  
  console.log('Token exists:', !!process.env.BOT_TOKEN);
  console.log('Token length:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);
  
  // Login with your bot token
  client.login(process.env.BOT_TOKEN);