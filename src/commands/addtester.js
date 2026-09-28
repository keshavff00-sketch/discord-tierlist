const { SlashCommandBuilder } = require("discord.js");
const { addTester } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addtester")
    .setDescription("[Admin] Grant a user tester permissions.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The user to promote").setRequired(true)
    )
    .setDefaultMemberPermissions(0), // hidden from non-admins by default in Discord's UI

  async execute(interaction) {
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    }

    const target = interaction.options.getUser("user", true);
    addTester(target.id);

    return interaction.reply(`✅ <@${target.id}> is now a DIFUSED TIERS tester.`);
  },
};
