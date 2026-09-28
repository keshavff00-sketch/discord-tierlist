const { SlashCommandBuilder } = require("discord.js");
const { GAMEMODE_KEYS, isValidGamemode } = require("../config");
const { overallLeaderboard, gamemodeLeaderboard } = require("../database");
const {
  overallLeaderboardEmbed,
  gamemodeLeaderboardEmbed,
} = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the DIFUSED TIERS leaderboard.")
    .addStringOption((opt) =>
      opt
        .setName("gamemode")
        .setDescription("Filter to a specific gamemode (optional)")
        .setRequired(false)
        .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
    ),

  async execute(interaction) {
    const gamemode = interaction.options.getString("gamemode");

    if (gamemode) {
      if (!isValidGamemode(gamemode)) {
        return interaction.reply({ content: "❌ Invalid gamemode.", ephemeral: true });
      }
      const entries = gamemodeLeaderboard(gamemode, 10);
      return interaction.reply({ embeds: [gamemodeLeaderboardEmbed(gamemode, entries)] });
    }

    const entries = overallLeaderboard(10);
    return interaction.reply({ embeds: [overallLeaderboardEmbed(entries)] });
  },
};
