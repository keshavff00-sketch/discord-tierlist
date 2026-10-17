const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { GAMEMODE_KEYS, TIERS, isValidGamemode, isValidTier, gamemodeByKey } = require("../config");
const { setTier, getPlayer, isTester } = require("../database");
const { profileEmbed } = require("../utils/embeds");
const { assignTierRole } = require("../utils/tierRoles");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setrank")
    .setDescription("[Tester] Set a player's tier for a gamemode.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The player to rank").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("gamemode")
        .setDescription("The gamemode being tested")
        .setRequired(true)
        .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
    )
    .addStringOption((opt) =>
      opt
        .setName("tier")
        .setDescription("The tier earned")
        .setRequired(true)
        .addChoices(...TIERS.map((t) => ({ name: t, value: t })))
    ),

  async execute(interaction) {
    if (!isTester(interaction.user.id) && !interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({
        content: "❌ Only testers or admins can set ranks.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = interaction.options.getUser("user", true);
    const gamemode = interaction.options.getString("gamemode", true);
    const tier = interaction.options.getString("tier", true);

    if (!isValidGamemode(gamemode) || !isValidTier(tier)) {
      return interaction.reply({ content: "❌ Invalid gamemode or tier.", flags: MessageFlags.Ephemeral });
    }

    const player = getPlayer(target.id);
    if (!player || !player.ign) {
      return interaction.reply({
        content: `❌ **${target.username}** hasn't registered a Minecraft account. Ask them to run \`/register\` first.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const updated = setTier(target.id, gamemode, tier);

    // Tier role assign (isi gamemode ka purana role hata ke naya dega)
    const gm = gamemodeByKey(gamemode);
    const roleNote = await assignTierRole(
      interaction.guild,
      target.id,
      gamemode,
      gm ? gm.name : gamemode,
      tier
    );

    await interaction.editReply({
      content: `✅ Set **${player.ign}**'s ${gamemode} tier to \`${tier}\`.${roleNote}`,
      embeds: [profileEmbed(updated)],
    });
  },
};
