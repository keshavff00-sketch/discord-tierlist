const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getPlayer, isAdmin } = require("../database");
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
    const viewingOther = target.id !== interaction.user.id;

    // Owners (bot admins from testers.json, or the Discord server owner)
    // can view anyone's profile. Everyone else only sees their own.
    const isOwner =
      isAdmin(interaction.user.id) || interaction.guild?.ownerId === interaction.user.id;

    if (viewingOther && !isOwner) {
      return interaction.reply({
        content: "❌ You can only view your own profile.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = getPlayer(target.id);

    if (!player || !player.ign) {
      return interaction.reply({
        content: viewingOther
          ? `❌ <@${target.id}> hasn't registered a Minecraft account yet.`
          : "❌ You haven't registered a Minecraft account yet. Use `/register` first.",
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({ embeds: [profileEmbed(player)] });
  },
};
