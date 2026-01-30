
const { SlashCommandBuilder } = require('discord.js');

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, "..", "..", 'wordle_stats.json');


module.exports = {
	data: new SlashCommandBuilder().setName('king').setDescription('wordle leaderboard'),
	async execute(interaction) {
        const guild = interaction.client.guilds.cache.get("1065718358986723470")
    const stats = loadStats()
    const sorted = Object.entries(stats.userStats).sort((a,b) => b[1].wins - a[1].wins).map(([userId, stats]) => ({userId, ...stats}))		
    const firstfive = sorted.slice(0,5).map((u)=>{
        const user = guild.members.cache.get(u.userId)
        return {
            name: user?.displayName??'undefined',
            ...u
        }
    })
    await interaction.reply(firstfive.map((u, i)=>`${i === 0 ? '👑 ' : ''} ${u.name} | ${u.wins} Wins`).join('\n'));
	},
};


function loadStats() {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
  return { userStats: {} };
}