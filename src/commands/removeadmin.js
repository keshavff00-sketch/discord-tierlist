const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { removeAdmin, isAdmin } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removeadmin")
    .setDescription("[Admin] Remove a user from the DIFUSED TIERS admin staff list.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The admin to remove").setRequired(true)
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({ content: "❌ Admins only.", flags: MessageFlags.Ephemeral });
    }

    const target = interaction.options.getUser("user", true);

    if (!isAdmin(target.id)) {
      return interaction.reply({
        content: `❌ <@${target.id}> admin list me nahi hai.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    removeAdmin(target.id);

    return interaction.reply(`✅ <@${target.id}> ko DIFUSED TIERS admin list se hata diya.`);
  },
};
