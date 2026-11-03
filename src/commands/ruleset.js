// ============================================================
// DIFUSED TIERS — /ruleset
// Admin command: posts the ruleset panel (one button per gamemode)
// in the current channel. Players click a button to see that
// gamemode's allowed / banned mods (reply is private to them).
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");
const { LOGO_PATH } = require("../config");
const { rulesetPanelEmbed, buildRulesetRows } = require("../utils/rulesets");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ruleset")
    .setDescription("[Admin] Post the ruleset panel (allowed / banned mods) in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Only administrators can post the ruleset panel.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await interaction.channel.send({
        embeds: [rulesetPanelEmbed()],
        components: buildRulesetRows(),
        files: [new AttachmentBuilder(LOGO_PATH, { name: "logo.png" })],
      });
    } catch (err) {
      console.error("[/ruleset] Failed to post panel:", err);
      return interaction.editReply(
        "❌ Couldn't post the panel here — check that I can send messages, embeds and attach files in this channel."
      );
    }

    return interaction.editReply("✅ Ruleset panel posted.");
  },
};
