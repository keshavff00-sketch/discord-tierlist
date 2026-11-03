// ============================================================
// DIFUSED TIERS — /rubrics
// Admin command: posts the ranked rubrics panel (one button per gamemode)
// in the current channel. Players click a button to see how testing works
// for that gamemode (reply is private to them).
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");
const { LOGO_PATH } = require("../config");
const { rubricsPanelEmbed, buildRubricRows } = require("../utils/rubrics");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rubrics")
    .setDescription("[Admin] Post the ranked rubrics panel in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Only administrators can post the rubrics panel.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.channel.send({
        embeds: [rubricsPanelEmbed()],
        components: buildRubricRows(),
        files: [new AttachmentBuilder(LOGO_PATH, { name: "logo.png" })],
      });
    } catch (err) {
      console.error("[/rubrics] Failed to post panel:", err);
      return interaction.editReply(
        "❌ Couldn't post the panel here — check that I can send messages, embeds and attach files in this channel."
      );
    }

    return interaction.editReply("✅ Rubrics panel posted.");
  },
};
