const { SlashCommandBuilder } = require("discord.js");
const { lookupUUID } = require("../utils/mojang");
const { upsertPlayer } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("Link your Minecraft username to your Discord account.")
    .addStringOption((opt) =>
      opt
        .setName("ign")
        .setDescription("Your Minecraft in-game name")
        .setRequired(true)
    ),

  async execute(interaction) {
    const ign = interaction.options.getString("ign", true);
    await interaction.deferReply();

    const result = await lookupUUID(ign);
    if (result.error) {
      const msg =
        result.error === "not_premium"
          ? `❌ Couldn't find a premium Minecraft account named **${ign}**, and cracked accounts aren't enabled on this server.`
          : result.error === "invalid_format"
          ? `❌ **${ign}** isn't a valid Minecraft username. It must be 3-16 characters, letters/numbers/underscores only.`
          : `❌ Couldn't reach Mojang to verify **${ign}** right now. Please try again in a moment.`;
      return interaction.editReply(msg);
    }

    upsertPlayer(interaction.user.id, {
      ign: result.ign,
      uuid: result.uuid,
      cracked: result.cracked,
    });

    if (result.cracked) {
      return interaction.editReply(
        `✅ Linked your Discord account to **${result.ign}** (cracked/offline account). Use \`/profile\` to view your tiers.`
      );
    }

    return interaction.editReply(
      `✅ Linked your Discord account to **${result.ign}**. Use \`/profile\` to view your tiers.`
    );
  },
};
