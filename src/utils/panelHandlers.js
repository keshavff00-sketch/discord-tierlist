// ============================================================
// DIFUSED TIERS — interaction handlers for the evaluation
// testing waitlist panel (/setup).
// ============================================================

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { lookupUUID } = require("./mojang");
const {
  upsertPlayer,
  getPlayer,
  waitlistCooldownRemaining,
  joinWaitlist,
  removeFromWaitlist,
  getQueueState,
  waitlistEntries,
  } = require("../database");
const { gamemodeByKey, normalizeRegion } = require("../config");
const { isTesterMember } = require("./permissions");
const {
  REGISTER_BUTTON_ID,
  REGISTER_MODAL_ID,
  REGISTER_MODAL_IGN_INPUT,
  WAITLIST_SELECT_ID,
  WAITLIST_MODAL_PREFIX,
  WAITLIST_MODAL_REGION_INPUT,
  WAITLIST_MODAL_USERNAME_INPUT,
  QUEUE_JOIN_PREFIX,
  QUEUE_LEAVE_PREFIX,
  TICKET_CLOSE_BUTTON_ID,
} = require("./panelIds");
const { queueOpenEmbed } = require("./embeds");

function formatDuration(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function handleRegisterButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(REGISTER_MODAL_ID)
    .setTitle("Register / Update Profile");

  const ignInput = new TextInputBuilder()
    .setCustomId(REGISTER_MODAL_IGN_INPUT)
    .setLabel("Minecraft in-game name (IGN)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  modal.addComponents(new ActionRowBuilder().addComponents(ignInput));
  await interaction.showModal(modal);
}

// Shared by both the old dropdown (/setup panel) and the new per-gamemode
// Join Queue button (/setup queue) — same modal, same customId scheme, so
// handleWaitlistModal below handles the submission either way.
function buildWaitlistModal(gm, player) {
  const modal = new ModalBuilder()
    .setCustomId(`${WAITLIST_MODAL_PREFIX}${gm.key}`)
    .setTitle(`Join ${gm.name} Waitlist`);

  const regionInput = new TextInputBuilder()
    .setCustomId(WAITLIST_MODAL_REGION_INPUT)
    .setLabel("Region (NA, EU, or AS/AU)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const usernameInput = new TextInputBuilder()
    .setCustomId(WAITLIST_MODAL_USERNAME_INPUT)
    .setLabel("Username you will be testing on")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32)
    .setValue(player.ign || "");

  modal.addComponents(
    new ActionRowBuilder().addComponents(regionInput),
    new ActionRowBuilder().addComponents(usernameInput)
  );

  return modal;
}

function buildJoinLeaveRow(gm) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${QUEUE_JOIN_PREFIX}${gm.key}`)
      .setLabel("Join Queue")
      .setStyle(ButtonStyle.Success)
      .setEmoji("➕"),
    new ButtonBuilder()
      .setCustomId(`${QUEUE_LEAVE_PREFIX}${gm.key}`)
      .setLabel("Leave Queue")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("➖")
  );
}

// Re-renders a gamemode's open queue panel (occupant list/count) after
// someone joins or leaves. No-op if the panel isn't open right now, or
// no panel has been posted for this gamemode — never throws.
async function refreshQueuePanel(guild, gm) {
  const state = getQueueState(gm.key);
  if (!state?.open || !state.messageId || !state.channelId) return;

  try {
    const channel = await guild.channels.fetch(state.channelId);
    const message = await channel.messages.fetch(state.messageId);
    const entries = waitlistEntries(gm.key);
    await message.edit({
      embeds: [queueOpenEmbed(gm, state, entries)],
      components: [buildJoinLeaveRow(gm)],
    });
  } catch (err) {
    console.error(`[queue panel] Failed to refresh panel for ${gm.key}:`, err.message);
  }
}

async function handleWaitlistSelect(interaction) {
  const gamemodeKey = interaction.values[0];
  const gm = gamemodeByKey(gamemodeKey);
  if (!gm) {
    return interaction.reply({ content: "❌ Unknown gamemode.", ephemeral: true });
  }

  // A dedicated /setup queue panel exists and is closed for this
  // gamemode — respect that even when joining via the older dropdown.
  const state = getQueueState(gm.key);
  if (state && !state.open) {
    return interaction.reply({
      content: `❌ The **${gm.name}** queue is currently closed. You'll be notified when it opens.`,
      ephemeral: true,
    });
  }

  const player = getPlayer(interaction.user.id);
  if (!player || !player.ign) {
    return interaction.reply({
      content: "❌ You need to **Register / Update Profile** first before joining a waitlist.",
      ephemeral: true,
    });
  }

  const remaining = waitlistCooldownRemaining(interaction.user.id, gamemodeKey);
  if (remaining > 0) {
    return interaction.reply({
      content: `⏳ You're on cooldown for **${gm.name}**. Try again in **${formatDuration(remaining)}**.`,
      ephemeral: true,
    });
  }

  await interaction.showModal(buildWaitlistModal(gm, player));
}

// Join Queue button on a /setup queue panel.
async function handleQueueJoinButton(interaction, gamemodeKey) {
  const gm = gamemodeByKey(gamemodeKey);
  if (!gm) {
    return interaction.reply({ content: "❌ Unknown gamemode.", ephemeral: true });
  }

  const state = getQueueState(gm.key);
  if (!state?.open) {
    return interaction.reply({
      content: `❌ The **${gm.name}** queue is currently closed.`,
      ephemeral: true,
    });
  }

  const player = getPlayer(interaction.user.id);
  if (!player || !player.ign) {
    return interaction.reply({
      content: "❌ You need to **Register / Update Profile** first (use the main panel's Register button) before joining a queue.",
      ephemeral: true,
    });
  }

  const remaining = waitlistCooldownRemaining(interaction.user.id, gamemodeKey);
  if (remaining > 0) {
    return interaction.reply({
      content: `⏳ You're on cooldown for **${gm.name}**. Try again in **${formatDuration(remaining)}**.`,
      ephemeral: true,
    });
  }

  await interaction.showModal(buildWaitlistModal(gm, player));
}

// Leave Queue button on a /setup queue panel.
async function handleQueueLeaveButton(interaction, gamemodeKey) {
  const gm = gamemodeByKey(gamemodeKey);
  if (!gm) {
    return interaction.reply({ content: "❌ Unknown gamemode.", ephemeral: true });
  }

  const removed = removeFromWaitlist(interaction.user.id, gm.key);
  if (!removed) {
    return interaction.reply({
      content: `❌ You're not currently in the **${gm.name}** queue.`,
      ephemeral: true,
    });
  }

  await removeQueueRole(interaction.guild, interaction.user.id, gm);
  await refreshQueuePanel(interaction.guild, gm);

  return interaction.reply({
    content: `✅ You've left the **${gm.name}** queue.`,
    ephemeral: true,
  });
}

async function handleRegisterModal(interaction) {
  const ign = interaction.fields.getTextInputValue(REGISTER_MODAL_IGN_INPUT);
  await interaction.deferReply({ ephemeral: true });

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

  upsertPlayer(interaction.user.id, { ign: result.ign, uuid: result.uuid, cracked: result.cracked });

  if (result.cracked) {
    return interaction.editReply(
      `✅ Linked your Discord account to **${result.ign}** (cracked/offline account). You can now join a gamemode waitlist from the panel.`
    );
  }

  return interaction.editReply(
    `✅ Linked your Discord account to **${result.ign}**. You can now join a gamemode waitlist from the panel.`
  );
}

async function handleWaitlistModal(interaction, gamemodeKey) {
  const gm = gamemodeByKey(gamemodeKey);
  if (!gm) {
    return interaction.reply({ content: "❌ Unknown gamemode.", ephemeral: true });
  }

  const rawRegion = interaction.fields.getTextInputValue(WAITLIST_MODAL_REGION_INPUT);
  const username = interaction.fields.getTextInputValue(WAITLIST_MODAL_USERNAME_INPUT);
  const region = normalizeRegion(rawRegion);

  if (!region) {
    return interaction.reply({
      content: `❌ Invalid region **${rawRegion}**. Please use \`NA\`, \`EU\`, or \`AS/AU\` and try again.`,
      ephemeral: true,
    });
  }

  // Re-check cooldown in case of a race between select and modal submit.
  const remaining = waitlistCooldownRemaining(interaction.user.id, gamemodeKey);
  if (remaining > 0) {
    return interaction.reply({
      content: `⏳ You're on cooldown for **${gm.name}**. Try again in **${formatDuration(remaining)}**.`,
      ephemeral: true,
    });
  }

  joinWaitlist(interaction.user.id, gamemodeKey, { region, username });

  const roleNote = await assignQueueRole(interaction, gm);
  await refreshQueuePanel(interaction.guild, gm);

  return interaction.reply({
    content: `✅ Joined the **${gm.name}** waitlist!\n**Region:** ${region}\n**Username:** ${username}\n\nA tester will reach out when it's your turn. You can rejoin this waitlist again in 7 days.${roleNote}`,
    ephemeral: true,
  });
}

// Gives the member the gamemode's configured "queue" role (e.g. the
// NethPot Queue role for NethPot PvP). Silently does nothing if no role
// is configured for this gamemode via <KEY>_QUEUE_ROLE_ID in .env.
// Never blocks the waitlist join on a role-assignment failure — it just
// appends a short note to the reply so the admin can fix permissions/ID.
async function assignQueueRole(interaction, gm) {
  if (!gm.queueRoleId) return "";

  try {
    const member = interaction.member ?? (await interaction.guild.members.fetch(interaction.user.id));
    if (member.roles.cache.has(gm.queueRoleId)) return "";

    await member.roles.add(gm.queueRoleId);
    return "";
  } catch (err) {
    console.error(`[queue role] Failed to assign role ${gm.queueRoleId} for ${gm.key}:`, err.message);
    return "\n⚠️ Couldn't auto-assign your queue role — please ask an admin to check.";
  }
}

// Removes a gamemode's "queue" role from a member — used by /pull once
// someone is taken out of the queue and into a ticket. Never throws;
// logs and returns false on failure so /pull can still finish the pull.
async function removeQueueRole(guild, discordId, gm) {
  if (!gm.queueRoleId) return true;

  try {
    const member = await guild.members.fetch(discordId);
    if (!member.roles.cache.has(gm.queueRoleId)) return true;
    await member.roles.remove(gm.queueRoleId);
    return true;
  } catch (err) {
    console.error(`[queue role] Failed to remove role ${gm.queueRoleId} for ${gm.key}:`, err.message);
    return false;
  }
}

// Close Ticket button on a /pull ticket channel. Testers/admins only —
// deletes the channel a few seconds after confirming, so the reply is
// still readable before it disappears.
async function handleTicketCloseButton(interaction) {
  if (!isTesterMember(interaction)) {
    return interaction.reply({
      content: "❌ Only testers or admins can close this ticket.",
      ephemeral: true,
    });
  }

  await interaction.reply(`🔒 Ticket closed by <@${interaction.user.id}>. This channel will be deleted shortly.`);

  setTimeout(() => {
    interaction.channel.delete().catch((err) => {
      console.error("[ticket close] Failed to delete channel:", err.message);
    });
  }, 5000);
}

async function handlePanelInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === REGISTER_BUTTON_ID) {
    return handleRegisterButton(interaction);
  }

  if (interaction.isStringSelectMenu() && interaction.customId === WAITLIST_SELECT_ID) {
    return handleWaitlistSelect(interaction);
  }

  if (interaction.isButton() && interaction.customId.startsWith(QUEUE_JOIN_PREFIX)) {
    const gamemodeKey = interaction.customId.slice(QUEUE_JOIN_PREFIX.length);
    return handleQueueJoinButton(interaction, gamemodeKey);
  }

  if (interaction.isButton() && interaction.customId.startsWith(QUEUE_LEAVE_PREFIX)) {
    const gamemodeKey = interaction.customId.slice(QUEUE_LEAVE_PREFIX.length);
    return handleQueueLeaveButton(interaction, gamemodeKey);
  }

  if (interaction.isButton() && interaction.customId === TICKET_CLOSE_BUTTON_ID) {
    return handleTicketCloseButton(interaction);
  }

  if (interaction.isModalSubmit() && interaction.customId === REGISTER_MODAL_ID) {
    return handleRegisterModal(interaction);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith(WAITLIST_MODAL_PREFIX)) {
    const gamemodeKey = interaction.customId.slice(WAITLIST_MODAL_PREFIX.length);
    return handleWaitlistModal(interaction, gamemodeKey);
  }

  return false; // not a panel interaction
}

module.exports = { handlePanelInteraction, removeQueueRole, buildJoinLeaveRow, refreshQueuePanel };
