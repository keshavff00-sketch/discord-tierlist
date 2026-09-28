const { SlashCommandBuilder } = require("discord.js");
const { GAMEMODE_KEYS, isValidGamemode } = require("../config");
const { removeTier, getPlayer, isTester } = require("../database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removerank")
    .setDescription("[Tester] Remove a player's tier for a gamemode.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The player").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("gamemode")
        .setDescription("The gamemode to clear")
        .setRequired(true)
        .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
    ),

  async execute(interaction) {
    if (!isTester(interaction.user.id) && !interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({
        content: "❌ Only testers or admins can remove ranks.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("user", true);
    const gamemode = interaction.options.getString("gamemode", true);

    if (!isValidGamemode(gamemode)) {
      return interaction.reply({ content: "❌ Invalid gamemode.", ephemeral: true });
    }

    const player = getPlayer(target.id);
    if (!player) {
      return interaction.reply({ content: "❌ That player has no data.", ephemeral: true });
    }

    removeTier(target.id, gamemode);
    return interaction.reply(`✅ Cleared **${player.ign}**'s ${gamemode} tier.`);
  },
};
