// ============================================================
// DIFUSED TIERS — interaction handlers for the evaluation
// testing waitlist panel (/setup).
// ============================================================

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const { lookupUUID } = require("./mojang");
const { upsertPlayer, getPlayer, waitlistCooldownRemaining, joinWaitlist } = require("../database");
const { gamemodeByKey, normalizeRegion } = require("../config");
const {
  REGISTER_BUTTON_ID,
  REGISTER_MODAL_ID,
  REGISTER_MODAL_IGN_INPUT,
  WAITLIST_SELECT_ID,
  WAITLIST_MODAL_PREFIX,
  WAITLIST_MODAL_REGION_INPUT,
  WAITLIST_MODAL_USERNAME_INPUT,
} = require("./panelIds");

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

async function handleWaitlistSelect(interaction) {
  const gamemodeKey = interaction.values[0];
  const gm = gamemodeByKey(gamemodeKey);
  if (!gm) {
    return interaction.reply({ content: "❌ Unknown gamemode.", ephemeral: true });
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

  const modal = new ModalBuilder()
    .setCustomId(`${WAITLIST_MODAL_PREFIX}${gamemodeKey}`)
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

  await interaction.showModal(modal);
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

  upsertPlayer(interaction.user.id, { ign: result.ign, uuid: result.uuid });

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

async function handlePanelInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === REGISTER_BUTTON_ID) {
    return handleRegisterButton(interaction);
  }

  if (interaction.isStringSelectMenu() && interaction.customId === WAITLIST_SELECT_ID) {
    return handleWaitlistSelect(interaction);
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

module.exports = { handlePanelInteraction };
