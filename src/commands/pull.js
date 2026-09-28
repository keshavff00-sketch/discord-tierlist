// ============================================================
// DIFUSED TIERS — /pull
// Takes the longest-waiting player out of a gamemode's test queue
// (joined via the /setup panel or /setup queue select menu) and opens
// a private ticket channel for the tester with that player's profile.
// ============================================================

const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const { GAMEMODE_KEYS, gamemodeByKey, TICKET_CATEGORY_ID, LOGO_PATH } = require("../config");
const {
  isTester,
  pullNextFromWaitlist,
  getPlayer,
} = require("../database");
const { ticketEmbed } = require("../utils/embeds");
const { removeQueueRole, refreshQueuePanel } = require("../utils/panelHandlers");
const { TICKET_CLOSE_BUTTON_ID } = require("../utils/panelIds");

// Attached to the ticket message so the embed's image can reference it
// as "attachment://logo.png" (same pattern as the /setup panels).
function logoAttachment() {
  return new AttachmentBuilder(LOGO_PATH, { name: "logo.png" });
}

function buildCloseTicketRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_CLOSE_BUTTON_ID)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒")
  );
}

// Discord channel names only allow lowercase letters, digits and hyphens.
function slugify(input) {
  return (input || "player")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "player";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pull")
    .setDescription("[Tester] Pull the next player from a gamemode's test queue and open a ticket.")
    .addStringOption((opt) =>
      opt
        .setName("gamemode")
        .setDescription("Which gamemode queue to pull from")
        .setRequired(true)
        .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
    ),

  async execute(interaction) {
    if (!isTester(interaction.user.id) && !interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({
        content: "❌ Only testers or admins can pull from the queue.",
        ephemeral: true,
      });
    }

    const gamemodeKey = interaction.options.getString("gamemode", true);
    const gm = gamemodeByKey(gamemodeKey);
    if (!gm) {
      return interaction.reply({ content: "❌ Unknown gamemode.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const pulled = pullNextFromWaitlist(gamemodeKey);
    if (!pulled) {
      return interaction.editReply(`📭 The **${gm.name}** queue is empty right now.`);
    }

    const { discordId, entry } = pulled;
    const player = getPlayer(discordId) || {
      discordId,
      ign: entry.username,
      uuid: null,
      region: entry.region,
      tiers: {},
    };

    // No longer actively queued — drop their queue role, if configured,
    // and refresh the queue panel embed so they disappear from the list
    // immediately (and the next person moves up to first position).
    await removeQueueRole(interaction.guild, discordId, gm);
    await refreshQueuePanel(interaction.guild, gm);

    const channelName = `${gm.key.toLowerCase()}-${slugify(entry.username || player.ign)}`;

    let ticketChannel;
    try {
      ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID || undefined,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: discordId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });
    } catch (err) {
      console.error("[/pull] Failed to create ticket channel:", err.message);
      return interaction.editReply(
        `❌ Pulled **${player.ign || entry.username}** from the queue, but couldn't create the ticket channel (check the bot's **Manage Channels** permission${
          TICKET_CATEGORY_ID ? " and its access to the ticket category" : ""
        }). They've been removed from the queue — you may want to message them directly.`
      );
    }

    await ticketChannel.send({
      content: `<@${interaction.user.id}> <@${discordId}> — new ${gm.name} test ticket.`,
      embeds: [ticketEmbed(player, gm, entry, interaction.user)],
      components: [buildCloseTicketRow()],
      files: [logoAttachment()],
    });

    return interaction.editReply(
      `✅ Pulled **${player.ign || entry.username}** from the **${gm.name}** queue — ticket opened: ${ticketChannel}`
    );
  },
};
