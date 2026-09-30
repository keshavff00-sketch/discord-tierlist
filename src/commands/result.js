// ============================================================
// DIFUSED TIERS — /result command.
// Lets a tester post a player's test-result card (rank before,
// rank earned, gamemode, tester) to a single dedicated channel,
// styled after the reference "FireFury_99's Test Results" embed.
// ============================================================

const { SlashCommandBuilder } = require("discord.js");
const { GAMEMODE_KEYS, gamemodeByKey, LOW_TIERS, RESULT_CHANNEL_ID } = require("../config");
const { isTesterMember } = require("../utils/permissions");
const { lookupUUID } = require("../utils/mojang");
const { testResultEmbed } = require("../utils/embeds");

// /result only covers LT3 and below (worse tiers) — HT3 and better go
// through /high-result instead. "Unranked" is offered alongside the
// real tiers for players being tested for the very first time.
const RANK_BEFORE_CHOICES = [{ name: "Unranked (first test)", value: "UNRANKED" }, ...LOW_TIERS.map((t) => ({ name: t, value: t }))];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("result")
    .setDescription("[Tester] Post a player's test result (LT3 and below) to the results channel.")
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
        .setDescription("The rank they earned in this test (LT3 and below)")
        .setRequired(true)
        .addChoices(...LOW_TIERS.map((t) => ({ name: t, value: t })))
    ),

  async execute(interaction) {
    if (!isTesterMember(interaction)) {
      return interaction.reply({
        content: "❌ Only testers or admins can post test results.",
        ephemeral: true,
      });
    }

    if (!RESULT_CHANNEL_ID) {
      return interaction.reply({
        content:
          "❌ `RESULT_CHANNEL_ID` isn't set yet. Add it to your `.env` (the channel where results should be posted) and restart the bot.",
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
    const cracked = lookup?.cracked ?? true; // unknown/failed lookup -> treat as cracked so Steve shows instead of a broken image

    let channel;
    try {
      channel = await interaction.client.channels.fetch(RESULT_CHANNEL_ID);
    } catch (err) {
      return interaction.editReply({
        content: "❌ Couldn't find the results channel — check that `RESULT_CHANNEL_ID` in `.env` is correct.",
      });
    }

    if (!channel?.isTextBased()) {
      return interaction.editReply({
        content: "❌ `RESULT_CHANNEL_ID` doesn't point to a text channel.",
      });
    }

    const embed = testResultEmbed({
      playerName,
      uuid,
      cracked,
      testerId: interaction.user.id,
      gamemodeLabel: gamemode ? `${gamemode.emoji} ${gamemode.name}` : gamemodeKey,
      rankBefore,
      rankEarned,
    });

    try {
      await channel.send({ content: `<@${target.id}>`, embeds: [embed] });
    } catch (err) {
      console.error("Failed to post test result:", err);
      return interaction.editReply({
        content: "❌ Couldn't post to the results channel — check I have permission to send messages/embeds there.",
      });
    }

    await interaction.editReply({ content: `✅ Result posted in <#${RESULT_CHANNEL_ID}>.` });
  },
};
