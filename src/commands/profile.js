const { SlashCommandBuilder, MessageFlags } = require("discord.js");
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

    // Players can only view their own profile.
    if (target.id !== interaction.user.id) {
      return interaction.reply({
        content: "❌ You can only view your own profile.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = getPlayer(target.id);

    if (!player || !player.ign) {
      return interaction.reply({
        content: "❌ You haven't registered a Minecraft account yet. Use `/register` first.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({ embeds: [profileEmbed(player)] });
  },
};
