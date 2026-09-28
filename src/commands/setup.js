const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { setupPanelEmbed, queueClosedEmbed, applicationPanelEmbed } = require("../utils/embeds");
const { GAMEMODES, GAMEMODE_KEYS, gamemodeByKey, LOGO_PATH } = require("../config");
const { setQueueState } = require("../database");

// Attached to panel messages so the embeds can reference it as
// "attachment://logo.png" for their thumbnail.
function logoAttachment() {
  return new AttachmentBuilder(LOGO_PATH, { name: "logo.png" });
}
const {
  REGISTER_BUTTON_ID,
  WAITLIST_SELECT_ID,
  APPLICATION_SELECT_ID,
  APPLICATION_TYPE_STAFF,
  APPLICATION_TYPE_TESTER,
} = require("../utils/panelIds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("[Admin] Post a DIFUSED TIERS panel in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Post the evaluation testing waitlist panel in this channel.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("queue")
        .setDescription("Post per-gamemode Join/Leave queue panels (testers open/close them with /queue).")
        .addStringOption((opt) =>
          opt
            .setName("gamemode")
            .setDescription("Only post for one gamemode (leave empty to post for all of them)")
            .addChoices(...GAMEMODE_KEYS.map((k) => ({ name: k, value: k })))
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("application")
        .setDescription("Post the Staff + Tester application panel in this channel.")
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has("Administrator")) {
      return interaction.reply({ content: "❌ Admins only.", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "application") {
      return postApplicationPanel(interaction);
    }

    if (subcommand === "queue") {
      return postQueuePanel(interaction);
    }

    return postWaitlistPanel(interaction);
  },
};

async function postWaitlistPanel(interaction) {
  const registerButton = new ButtonBuilder()
    .setCustomId(REGISTER_BUTTON_ID)
    .setLabel("Register / Update Profile")
    .setStyle(ButtonStyle.Success)
    .setEmoji("📝");

  const gamemodeSelect = new StringSelectMenuBuilder()
    .setCustomId(WAITLIST_SELECT_ID)
    .setPlaceholder("📄 Select a gamemode to join its waitlist")
    .addOptions(
      GAMEMODES.map((g) => ({
        label: g.name,
        value: g.key,
        emoji: g.emoji,
      }))
    );

  await interaction.channel.send({
    embeds: [setupPanelEmbed()],
    files: [logoAttachment()],
    components: [
      new ActionRowBuilder().addComponents(registerButton),
      new ActionRowBuilder().addComponents(gamemodeSelect),
    ],
  });

  return interaction.reply({
    content: "✅ Waitlist panel posted in this channel.",
    ephemeral: true,
  });
}

async function postQueuePanel(interaction) {
  const gamemodeOption = interaction.options.getString("gamemode");
  const targets = gamemodeOption ? [gamemodeByKey(gamemodeOption)] : GAMEMODES;

  await interaction.deferReply({ ephemeral: true });

  const posted = [];
  for (const gm of targets) {
    const msg = await interaction.channel.send({
      embeds: [queueClosedEmbed(gm, { closedAt: Date.now() })],
    });

    setQueueState(gm.key, {
      open: false,
      messageId: msg.id,
      channelId: msg.channel.id,
      closedAt: Date.now(),
    });

    posted.push(gm.name);
  }

  return interaction.editReply(
    `✅ Posted queue panel${posted.length > 1 ? "s" : ""} for: **${posted.join(", ")}**.\nUse \`/queue open <gamemode>\` to open one for testing.`
  );
}

async function postApplicationPanel(interaction) {
  const applicationSelect = new StringSelectMenuBuilder()
    .setCustomId(APPLICATION_SELECT_ID)
    .setPlaceholder("Make a selection")
    .addOptions(
      {
        label: "Staff Application",
        value: APPLICATION_TYPE_STAFF,
        description: "Click on this option to start the staff application process",
        emoji: "🛡️",
      },
      {
        label: "Tester Application",
        value: APPLICATION_TYPE_TESTER,
        description: "Click on this option to start the tester application process",
        emoji: "⚔️",
      }
    );

  await interaction.channel.send({
    embeds: [applicationPanelEmbed()],
    files: [logoAttachment()],
    components: [new ActionRowBuilder().addComponents(applicationSelect)],
  });

  return interaction.reply({
    content: "✅ Application panel posted in this channel.",
    ephemeral: true,
  });
}
