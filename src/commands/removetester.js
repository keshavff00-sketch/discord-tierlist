const { SlashCommandBuilder } = require("discord.js");
const { removeTester } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removetester")
    .setDescription("[Admin] Revoke a user's tester permissions.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to demote").setRequired(true)
    )
    .setDefaultMemberPermissions(0),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    }

    const target = interaction.options.getUser("user", true);
    removeTester(target.id);

    return interaction.reply(`✅ <@${target.id}> is no longer a DIFUSED TIERS tester.`);
  },
};
