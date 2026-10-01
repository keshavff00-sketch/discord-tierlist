// ============================================================
// DIFUSED TIERS — /queue open, /queue close
// Testers use these to open/close a specific gamemode's queue panel
// (posted by /setup queue). Opening shows Join/Leave buttons and the
// live queue list; closing matches the "queue is now closed" state.
// ============================================================

const {
  SlashCommandBuilder,
} = require("discord.js");
const { GAMEMODE_KEYS, gamemodeByKey } = require("../config");
const { getQueueState, setQueueState, waitlistEntries } = require("../database");
const { isTesterMember } = require("../utils/permissions");
const { queueOpenEmbed, queueClosedEmbed } = require("../utils/embeds");
const { buildJoinLeaveRow } = require("../utils/panelHandlers");

// Fetches the panel message a gamemode's queue state points at.
// Returns null (and lets the caller reply with an error) if it's
// missing — e.g. /setup queue was never run, or the message was deleted.
async function fetchPanelMessage(interaction, state) {
  if (!state?.messageId || !state?.channelId) return null;
  try {
    const channel = await interaction.guild.channels.fetch(state.channelId);
    return await channel.messages.fetch(state.messageId);
  } catch (err) {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("[Tester] Open or close a gamemode's test queue.")
    .addSubcommand((sub) =>
      sub
        .setName("open")
        .setDescription("Open a gamemode's queue for testing.")
        .addStringOption((opt) =>
          opt
            .setName("gamemode")
            .setDescription("Which gamemode queue to open")
            .setRequired(true)
            .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close a gamemode's queue.")
        .addStringOption((opt) =>
          opt
            .setName("gamemode")
            .setDescription("Which gamemode queue to close")
            .setRequired(true)
            .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
        )
    ),

  async execute(interaction) {
    if (!isTesterMember(interaction)) {
      return interaction.reply({
        content: "❌ Only testers or admins can open/close queues.",
        ephemeral: true,
      });
    }

    const gamemodeKey = interaction.options.getString("gamemode", true);
    const gm = gamemodeByKey(gamemodeKey);
    if (!gm) {
      return interaction.reply({ content: "❌ Unknown gamemode.", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const state = getQueueState(gm.key);

    if (!state?.messageId) {
      return interaction.reply({
        content: `❌ No queue panel found for **${gm.name}**. Run \`/setup queue gamemode:${gm.key}\` in the channel you want it posted in first.`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const message = await fetchPanelMessage(interaction, state);
    if (!message) {
      return interaction.editReply(
        `❌ Couldn't find **${gm.name}**'s queue panel message (it may have been deleted). Run \`/setup queue gamemode:${gm.key}\` again to repost it.`
      );
    }

    if (subcommand === "open") {
      const newState = setQueueState(gm.key, {
        open: true,
        openedBy: interaction.user.id,
        openedAt: Date.now(),
      });

      const entries = waitlistEntries(gm.key);
      await message.edit({
        embeds: [queueOpenEmbed(gm, newState, entries)],
        components: [buildJoinLeaveRow(gm)],
      });

      if (gm.queueRoleId) {
        try {
          await message.channel.send(
            `<@&${gm.queueRoleId}> The **${gm.name}** queue is now open! Click **Join Queue** above.`
          );
        } catch (err) {
          console.error(`[/queue open] Failed to send role ping for ${gm.key}:`, err.message);
        }
      }

      return interaction.editReply(`✅ **${gm.name}** queue is now **open**.`);
    }

    // close
    const newState = setQueueState(gm.key, {
      open: false,
      closedAt: Date.now(),
    });

    await message.edit({
      embeds: [queueClosedEmbed(gm, newState)],
      components: [],
    });

    return interaction.editReply(`✅ **${gm.name}** queue is now **closed**.`);
  },
};
