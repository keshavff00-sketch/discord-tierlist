// ============================================================
// DIFUSED TIERS — /high-result command.
// Same as /result, but restricted to HT3 and better (HT1, LT1,
// HT2, LT2, HT3) — the elite half of the tier list. /result
// covers the rest (LT3 and below).
// ============================================================

const { SlashCommandBuilder } = require("discord.js");
const { GAMEMODE_KEYS, gamemodeByKey, HIGH_TIERS, HIGH_RESULT_CHANNEL_ID } = require("../config");
const { isTester } = require("../database");
const { lookupUUID } = require("../utils/mojang");
const { testResultEmbed } = require("../utils/embeds");

// "Unranked" is offered alongside the real tiers for players being
// tested for the very first time (no prior rank to show).
const RANK_BEFORE_CHOICES = [{ name: "Unranked (first test)", value: "UNRANKED" }, ...HIGH_TIERS.map((t) => ({ name: t, value: t }))];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("high-result")
    .setDescription("[Tester] Post a player's test result (HT3 and above) to the results channel.")
    .addUserOption((opt) =>
      opt.setName("discord_user").setDescription("The player who was tested").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("minecraft_username").setDescription("Their Minecraft username").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("gamemode")
        .setDescription("The gamemode they were tested in")
        .setRequired(true)
        .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
    )
    .addStringOption((opt) =>
      opt
        .setName("rank_before")
        .setDescription("Their rank before this test")
        .setRequired(true)
        .addChoices(...RANK_BEFORE_CHOICES)
    )
    .addStringOption((opt) =>
      opt
        .setName("rank_earned")
        .setDescription("The rank they earned in this test (HT3 and above)")
        .setRequired(true)
        .addChoices(...HIGH_TIERS.map((t) => ({ name: t, value: t })))
    ),

  async execute(interaction) {
    if (!isTester(interaction.user.id) && !interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({
        content: "❌ Only testers or admins can post test results.",
        ephemeral: true,
      });
    }

    if (!HIGH_RESULT_CHANNEL_ID) {
      return interaction.reply({
        content:
          "❌ `HIGH_RESULT_CHANNEL_ID` isn't set yet. Add it to your `.env` (the channel where results should be posted) and restart the bot.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("discord_user", true);
    const mcUsername = interaction.options.getString("minecraft_username", true);
    const gamemodeKey = interaction.options.getString("gamemode", true);
    const rankBeforeRaw = interaction.options.getString("rank_before", true);
    const rankEarned = interaction.options.getString("rank_earned", true);

    const gamemode = gamemodeByKey(gamemodeKey);
    const rankBefore = rankBeforeRaw === "UNRANKED" ? "Unranked" : rankBeforeRaw;

    await interaction.deferReply({ ephemeral: true });

    // Best-effort head render for the embed thumbnail — a bad/unknown
    // username shouldn't block posting the result.
    const lookup = await lookupUUID(mcUsername).catch(() => null);
    const playerName = lookup?.ign || mcUsername;
    const uuid = lookup?.uuid || null;

    let channel;
    try {
      channel = await interaction.client.channels.fetch(HIGH_RESULT_CHANNEL_ID);
    } catch (err) {
      return interaction.editReply({
        content: "❌ Couldn't find the results channel — check that `HIGH_RESULT_CHANNEL_ID` in `.env` is correct.",
      });
    }

    if (!channel?.isTextBased()) {
      return interaction.editReply({
        content: "❌ `HIGH_RESULT_CHANNEL_ID` doesn't point to a text channel.",
      });
    }

    const embed = testResultEmbed({
      playerName,
      uuid,
      testerId: interaction.user.id,
      gamemodeLabel: gamemode ? `${gamemode.emoji} ${gamemode.name}` : gamemodeKey,
      rankBefore,
      rankEarned,
    });

    try {
      await channel.send({ content: `<@${target.id}>`, embeds: [embed] });
    } catch (err) {
      console.error("Failed to post high test result:", err);
      return interaction.editReply({
        content: "❌ Couldn't post to the results channel — check I have permission to send messages/embeds there.",
      });
    }

    await interaction.editReply({ content: `✅ Result posted in <#${HIGH_RESULT_CHANNEL_ID}>.` });
  },
};
