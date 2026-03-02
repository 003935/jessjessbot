const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("king")
    .setDescription("wordle leaderboard"),
  async execute(interaction) {
    const guild = await interaction.client.guilds.fetch(process.env.GUILD_ID);


    const sorted = Object.entries(stats.userStats)
      .sort((a, b) => b[1].wins - a[1].wins)
      .map(([userId, stats]) => ({ userId, ...stats }));
    if (sorted.length === 0) {
      await interaction.reply("no stats!!");
      return;
    }
    const firstfive = await Promise.all(
      sorted.slice(0, 5).map(async (u) => {
        const user = await guild.members.fetch(u.userId);
        return {
          name: user?.displayName ?? "undefined",
          ...u,
        };
      }),
    );
    await interaction.reply(
      firstfive
        .map((u, i) => `${i === 0 ? "👑 " : ""} ${u.name} | ${u.wins} Wins`)
        .join("\n"),
    );
  },
};