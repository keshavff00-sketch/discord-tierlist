const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getStaff } = require("../database");
const { BRAND } = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("testers")
    .setDescription("List the current DIFUSED TIERS testers and admins."),

  async execute(interaction) {
    const staff = getStaff();

    const adminMentions = staff.admins.length
      ? staff.admins.map((id) => `<@${id}>`).join("\n")
      : "_None set_";
    const testerMentions = staff.testers.length
      ? staff.testers.map((id) => `<@${id}>`).join("\n")
      : "_None set_";

    const embed = new EmbedBuilder()
      .setColor(0x9b5de5)
      .setTitle(`${BRAND} — Staff`)
      .addFields(
        { name: "🛡️ Admins", value: adminMentions, inline: true },
        { name: "🧪 Testers", value: testerMentions, inline: true }
      )
      .setFooter({ text: BRAND });

    return interaction.reply({ embeds: [embed] });
  },
};
