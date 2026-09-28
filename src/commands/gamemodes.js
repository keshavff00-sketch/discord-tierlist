const { SlashCommandBuilder } = require("discord.js");
const { gamemodesListEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gamemodes")
    .setDescription("List every gamemode DIFUSED TIERS tracks."),

  async execute(interaction) {
    return interaction.reply({ embeds: [gamemodesListEmbed()] });
  },
};
