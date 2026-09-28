const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../database");
const { profileEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a player's DIFUSED TIERS profile.")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("The Discord user to look up (defaults to you)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("user") || interaction.user;
    const player = getPlayer(target.id);

    if (!player || !player.ign) {
      const who = target.id === interaction.user.id ? "You haven't" : `**${target.username}** hasn't`;
      return interaction.reply({
        content: `❌ ${who} registered a Minecraft account yet. Use \`/register\` first.`,
        ephemeral: true,
      });
    }

    return interaction.reply({ embeds: [profileEmbed(player)] });
  },
};
