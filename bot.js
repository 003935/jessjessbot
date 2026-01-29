if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
  const { Client, GatewayIntentBits } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  const axios = require('axios');
  
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
  
  // League of Legends tracking
  const LEAGUE_FILE = path.join(__dirname, 'league_players.json');
  const RIOT_API_KEY = process.env.RIOT_API_KEY;
  
  // Region mappings
  const REGION_PLATFORMS = {
    'NA': 'na1',
    'EUW': 'euw1',
    'EUNE': 'eun1',
    'KR': 'kr',
    'BR': 'br1',
    'LAN': 'la1',
    'LAS': 'la2',
    'OCE': 'oc1',
    'TR': 'tr1',
    'RU': 'ru',
    'JP': 'jp1'
  };
  
  const REGION_ROUTING = {
    'NA': 'americas',
    'BR': 'americas',
    'LAN': 'americas',
    'LAS': 'americas',
    'EUW': 'europe',
    'EUNE': 'europe',
    'TR': 'europe',
    'RU': 'europe',
    'KR': 'asia',
    'JP': 'asia',
    'OCE': 'sea'
  };
  
  // Load or initialize League players
  function loadLeaguePlayers() {
    try {
      if (fs.existsSync(LEAGUE_FILE)) {
        return JSON.parse(fs.readFileSync(LEAGUE_FILE, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading League players:', error);
    }
    return [];
  }
  
  function saveLeaguePlayers(players) {
    try {
      fs.writeFileSync(LEAGUE_FILE, JSON.stringify(players, null, 2));
    } catch (error) {
      console.error('Error saving League players:', error);
    }
  }
  
  let leaguePlayers = loadLeaguePlayers();
  
  // Function to get summoner data from Riot API
  async function getSummonerData(gameName, tagLine, region) {
    try {
      const regionUpper = region.toUpperCase();
      const platform = REGION_PLATFORMS[regionUpper];
      const routing = REGION_ROUTING[regionUpper];
      
      if (!platform || !routing) {
        throw new Error('Invalid region');
      }
  
      // Step 1: Get PUUID from Riot ID
      const accountUrl = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
      const accountResponse = await axios.get(accountUrl, {
        headers: { 'X-Riot-Token': RIOT_API_KEY }
      });
      
      const puuid = accountResponse.data.puuid;
  
      // Step 2: Get summoner data from PUUID
      const summonerUrl = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
      const summonerResponse = await axios.get(summonerUrl, {
        headers: { 'X-Riot-Token': RIOT_API_KEY }
      });
      
      const summonerId = summonerResponse.data.id;
  
      // Step 3: Get ranked data
      const rankedUrl = `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
      const rankedResponse = await axios.get(rankedUrl, {
        headers: { 'X-Riot-Token': RIOT_API_KEY }
      });
  
      // Find Solo/Duo queue rank
      const soloQueue = rankedResponse.data.find(queue => queue.queueType === 'RANKED_SOLO_5x5');
      
      return {
        gameName,
        tagLine,
        region: regionUpper,
        puuid,
        tier: soloQueue ? soloQueue.tier : 'UNRANKED',
        rank: soloQueue ? soloQueue.rank : '',
        lp: soloQueue ? soloQueue.leaguePoints : 0,
        wins: soloQueue ? soloQueue.wins : 0,
        losses: soloQueue ? soloQueue.losses : 0
      };
    } catch (error) {
      console.error('Error fetching summoner data:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.status, error.response.data);
      }
      throw error;
    }
  }
  
  // Function to calculate rank value for sorting
  function getRankValue(tier, rank, lp) {
    const tierValues = {
      'CHALLENGER': 9000,
      'GRANDMASTER': 8000,
      'MASTER': 7000,
      'DIAMOND': 6000,
      'EMERALD': 5000,
      'PLATINUM': 4000,
      'GOLD': 3000,
      'SILVER': 2000,
      'BRONZE': 1000,
      'IRON': 0,
      'UNRANKED': -1
    };
    
    const rankValues = {
      'I': 400,
      'II': 300,
      'III': 200,
      'IV': 100
    };
    
    const tierValue = tierValues[tier] || -1;
    const rankValue = rankValues[rank] || 0;
    
    return tierValue + rankValue + lp;
  }
  
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
      console.log('🎯 Stats command detected!');
      const sortedStats = Object.entries(wordleStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
  
      if (sortedStats.length === 0) {
        console.log('📊 No stats found');
        await message.channel.send('No Wordle King wins recorded yet! 👑');
        return;
      }
  
      console.log('📊 Sending leaderboard with', sortedStats.length, 'entries');
      let leaderboard = '**👑 Wordle King Leaderboard 👑**\n\n';
      sortedStats.forEach(([userId, wins], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        leaderboard += `${medal} <@${userId}>: **${wins}** wins\n`;
      });
  
      await message.channel.send(leaderboard);
      console.log('✅ Leaderboard sent!');
      return;
    }
  
    // !addplayer command
    if (message.content.toLowerCase().startsWith('!addplayer ')) {
        if (message.content.toLowerCase().startsWith('!addplayer ')) {
            console.log('🎮 Add player command detected!');
            console.log('RIOT_API_KEY exists:', !!RIOT_API_KEY);
            
            const args = message.content.slice('!addplayer '.length).trim();
      const args = message.content.slice('!addplayer '.length).trim();
      const match = args.match(/^(.+)#(\w+)\s+(\w+)$/);
      
      if (!match) {
        await message.channel.send('❌ Invalid format! Use: `!addplayer name#tag REGION`\nExample: `!addplayer awg#QAQ EUW`');
        return;
      }
      
      const [, gameName, tagLine, region] = match;
      
      if (!REGION_PLATFORMS[region.toUpperCase()]) {
        await message.channel.send(`❌ Invalid region! Valid regions: ${Object.keys(REGION_PLATFORMS).join(', ')}`);
        return;
      }
      
      await message.channel.send('🔍 Looking up summoner...');
      
      try {
        const summonerData = await getSummonerData(gameName, tagLine, region);
        
        // Check if player already exists
        const existingIndex = leaguePlayers.findIndex(p => p.puuid === summonerData.puuid);
        if (existingIndex !== -1) {
          leaguePlayers[existingIndex] = summonerData;
          await message.channel.send(`✅ Updated **${gameName}#${tagLine}** (${region}) - ${summonerData.tier} ${summonerData.rank} ${summonerData.lp} LP`);
        } else {
          leaguePlayers.push(summonerData);
          await message.channel.send(`✅ Added **${gameName}#${tagLine}** (${region}) - ${summonerData.tier} ${summonerData.rank} ${summonerData.lp} LP`);
        }
        
        saveLeaguePlayers(leaguePlayers);
      } catch (error) {
        await message.channel.send('❌ Failed to find summoner. Check the name, tag, and region are correct!');
      }
      
      return;
    }
    
    // !removeplayer command
    if (message.content.toLowerCase().startsWith('!removeplayer ')) {
      const args = message.content.slice('!removeplayer '.length).trim();
      const match = args.match(/^(.+)#(\w+)$/);
      
      if (!match) {
        await message.channel.send('❌ Invalid format! Use: `!removeplayer name#tag`\nExample: `!removeplayer awg#QAQ`');
        return;
      }
      
      const [, gameName, tagLine] = match;
      
      const index = leaguePlayers.findIndex(p => 
        p.gameName.toLowerCase() === gameName.toLowerCase() && 
        p.tagLine.toLowerCase() === tagLine.toLowerCase()
      );
      
      if (index === -1) {
        await message.channel.send(`❌ Player **${gameName}#${tagLine}** not found in tracking list.`);
        return;
      }
      
      leaguePlayers.splice(index, 1);
      saveLeaguePlayers(leaguePlayers);
      await message.channel.send(`✅ Removed **${gameName}#${tagLine}** from tracking.`);
      return;
    }
    
    // !leagueranks or !lolranks command
    if (message.content.toLowerCase() === '!leagueranks' || message.content.toLowerCase() === '!lolranks') {
      if (leaguePlayers.length === 0) {
        await message.channel.send('📊 No players being tracked yet! Add players with `!addplayer name#tag REGION`');
        return;
      }
      
      await message.channel.send('🔄 Fetching latest ranks...');
      
      try {
        // Refresh all player data
        const updatedPlayers = [];
        for (const player of leaguePlayers) {
          try {
            const updated = await getSummonerData(player.gameName, player.tagLine, player.region);
            updatedPlayers.push(updated);
          } catch (error) {
            // If fetch fails, keep old data
            updatedPlayers.push(player);
          }
        }
        
        leaguePlayers = updatedPlayers;
        saveLeaguePlayers(leaguePlayers);
        
        // Sort by rank
        const sorted = [...leaguePlayers].sort((a, b) => {
          return getRankValue(b.tier, b.rank, b.lp) - getRankValue(a.tier, a.rank, a.lp);
        });
        
        let leaderboard = '**🎮 League of Legends Ranks 🎮**\n\n';
        sorted.forEach((player, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          const rankDisplay = player.tier === 'UNRANKED' 
            ? 'Unranked' 
            : `${player.tier} ${player.rank} - ${player.lp} LP`;
          leaderboard += `${medal} **${player.gameName}#${player.tagLine}** (${player.region}): ${rankDisplay}\n`;
        });
        
        await message.channel.send(leaderboard);
      } catch (error) {
        await message.channel.send('❌ Error fetching ranks. Please try again later.');
        console.error('League ranks error:', error);
      }
      
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
      await message.channel.send(`Congratulations i guess hmph... ${winnerNames[0]}! You are the new Wordle King! 👑 (Total wins: ${totalWins})`);
    } else {
      await message.channel.send(`Congratulations i guess hmph...  ${winnerNames.join(', ')}! You are the new Wordle Kings! 👑 (Tied with ${winningScore}/6)`);
    }
  });
  
  console.log('Token exists:', !!process.env.BOT_TOKEN);
  console.log('Token length:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);
  
  // Login with your bot token
  client.login(process.env.BOT_TOKEN);