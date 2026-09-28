// ============================================================
// DIFUSED TIERS — interaction handlers for the Staff / Tester
// application panel (/setup application).
//
// Flow:
//   1. User picks "Staff Application" or "Tester Application"
//      from the select menu on the panel.
//   2. Bot DMs the user, then asks each of the 15 questions one
//      at a time, waiting for a reply before sending the next.
//   3. Once all 15 are answered, the bot saves the application
//      and posts a summary embed to the staff review channel
//      (APPLICATION_LOG_CHANNEL_ID), and confirms to the user.
// ============================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const crypto = require("crypto");
const { BRAND, BRAND_COLOR, APPLICATION_LOG_CHANNEL_ID, STAFF_ROLE_ID, TESTER_ROLE_ID } = require("../config");
const {
  saveApplication,
  getApplicationById,
  updateApplicationStatus,
  isAdmin,
  isTester,
  addTester,
  addAdmin,
} = require("../database");
const { TESTER_QUESTIONS, STAFF_QUESTIONS } = require("../data/applicationQuestions");
const {
  APPLICATION_SELECT_ID,
  APPLICATION_TYPE_STAFF,
  APPLICATION_TYPE_TESTER,
  APPLICATION_ACCEPT_PREFIX,
  APPLICATION_DENY_PREFIX,
} = require("./panelIds");

const QUESTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per question

// Tracks users currently filling out an application so they can't start
// a second one (or double-click the select menu) while one is in progress.
const activeApplications = new Set();

const APPLICATION_META = {
  [APPLICATION_TYPE_STAFF]: { label: "Staff Application", questions: STAFF_QUESTIONS, emoji: "🛡️" },
  [APPLICATION_TYPE_TESTER]: { label: "Tester Application", questions: TESTER_QUESTIONS, emoji: "⚔️" },
};

// Which role to auto-assign when each application type is accepted.
const ROLE_FOR_TYPE = {
  [APPLICATION_TYPE_STAFF]: STAFF_ROLE_ID,
  [APPLICATION_TYPE_TESTER]: TESTER_ROLE_ID,
};

function reviewButtons(id, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${APPLICATION_ACCEPT_PREFIX}${id}`)
      .setLabel("Accept")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${APPLICATION_DENY_PREFIX}${id}`)
      .setLabel("Deny")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

function buildApplicationEmbed(meta, user, answers, submittedAt) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${meta.emoji} New ${meta.label}`)
    .setDescription(`**Applicant:** ${user} (\`${user.tag}\` / \`${user.id}\`)\n**Status:** ⏳ Pending review`)
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: BRAND })
    .setTimestamp(submittedAt);

  // Discord embeds allow max 25 fields; 15 Q&A pairs fits fine.
  for (const { question, answer } of answers) {
    embed.addFields({
      name: question.slice(0, 256),
      value: (answer || "—").slice(0, 1024),
    });
  }

  return embed;
}

function isStaffMember(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    isAdmin(interaction.user.id) ||
    isTester(interaction.user.id)
  );
}

async function askQuestions(dmChannel, user, questions) {
  const answers = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    await dmChannel.send(
      `**Question ${i + 1}/${questions.length}**\n${question}`
    );

    const collected = await dmChannel
      .awaitMessages({
        filter: (m) => m.author.id === user.id,
        max: 1,
        time: QUESTION_TIMEOUT_MS,
        errors: ["time"],
      })
      .catch(() => null);

    if (!collected || collected.size === 0) {
      await dmChannel.send(
        "⏰ You took too long to respond, so this application has been cancelled. Run `/setup application` again (or pick the option again on the panel) to restart."
      );
      return null;
    }

    answers.push({ question, answer: collected.first().content || "*(no text — attachment/empty message)*" });
  }

  return answers;
}

async function handleApplicationSelect(interaction) {
  const type = interaction.values[0];
  const meta = APPLICATION_META[type];

  if (!meta) {
    return interaction.reply({ content: "❌ Unknown application type.", ephemeral: true });
  }

  const user = interaction.user;

  if (activeApplications.has(user.id)) {
    return interaction.reply({
      content: "⏳ You already have an application in progress in your DMs. Finish or wait for it to time out before starting another.",
      ephemeral: true,
    });
  }

  // Acknowledge the interaction FIRST. Creating the DM channel and sending
  // the opening message are separate Discord API calls — if either is even
  // a little slow, the ~3s interaction window can expire before we reply,
  // causing "Unknown interaction" (10062) and a broken/blank application.
  await interaction.reply({
    content: `📬 Check your DMs! I've sent you the **${meta.label}** questions.`,
    ephemeral: true,
  });

  let dmChannel;
  try {
    dmChannel = await user.createDM();
    await dmChannel.send(
      `${meta.emoji} **${meta.label} — ${BRAND}**\n\nI'll ask you **${meta.questions.length} questions**, one at a time. Just reply here in DMs with your answer to move to the next question. You have 5 minutes per question.\n\nLet's begin!`
    );
  } catch (err) {
    await interaction.editReply({
      content:
        "❌ I couldn't DM you. Please enable **Direct Messages from server members** for this server (Privacy Settings) and try again.",
    });
    return;
  }

  activeApplications.add(user.id);

  try {
    const answers = await askQuestions(dmChannel, user, meta.questions);
    if (!answers) return; // timed out / cancelled, message already sent

    const submittedAt = Date.now();
    const id = crypto.randomUUID();
    saveApplication({
      id,
      discordId: user.id,
      discordTag: user.tag,
      type,
      answers,
      submittedAt,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
    });

    await dmChannel.send(
      `✅ **Your ${meta.label.toLowerCase()} has been submitted!** Staff will review it and reach out. Thanks for applying to ${BRAND}!`
    );

    if (APPLICATION_LOG_CHANNEL_ID) {
      try {
        const logChannel = await interaction.client.channels.fetch(APPLICATION_LOG_CHANNEL_ID);
        if (logChannel?.isTextBased()) {
          const embed = buildApplicationEmbed(meta, user, answers, submittedAt);
          await logChannel.send({ embeds: [embed], components: [reviewButtons(id)] });
        }
      } catch (err) {
        console.error("Failed to post application to log channel:", err);
      }
    } else {
      console.warn(
        "⚠️  APPLICATION_LOG_CHANNEL_ID is not set in .env — applications are only saved to data/applications.json, not posted to a channel."
      );
    }
  } catch (err) {
    console.error("Error running application flow:", err);
    await dmChannel
      .send("❌ Something went wrong while processing your application. Please try again later.")
      .catch(() => {});
  } finally {
    activeApplications.delete(user.id);
  }
}

async function handleApplicationReviewButton(interaction) {
  const isAccept = interaction.customId.startsWith(APPLICATION_ACCEPT_PREFIX);
  const isDeny = interaction.customId.startsWith(APPLICATION_DENY_PREFIX);
  if (!isAccept && !isDeny) return false;

  if (!isStaffMember(interaction)) {
    await interaction.reply({
      content: "❌ Only Staff/Testers (or Admins) can review applications.",
      ephemeral: true,
    });
    return true;
  }

  const id = interaction.customId.slice(
    isAccept ? APPLICATION_ACCEPT_PREFIX.length : APPLICATION_DENY_PREFIX.length
  );
  const application = getApplicationById(id);

  if (!application) {
    await interaction.reply({ content: "❌ Couldn't find this application in the records.", ephemeral: true });
    return true;
  }

  if (application.status !== "pending") {
    await interaction.reply({
      content: `⚠️ This application was already **${application.status}** by <@${application.reviewedBy}>.`,
      ephemeral: true,
    });
    return true;
  }

  const decision = isAccept ? "accepted" : "denied";
  const meta = APPLICATION_META[application.type];

  updateApplicationStatus(id, {
    status: decision,
    reviewedBy: interaction.user.id,
    reviewedAt: Date.now(),
  });

  // Update the embed in the log channel: new status line + disabled buttons.
  const original = interaction.message.embeds[0];
  const updatedEmbed = original
    ? EmbedBuilder.from(original).setColor(isAccept ? 0x2ecc71 : 0xe74c3c)
    : new EmbedBuilder();
  const statusLine = isAccept
    ? `**Status:** ✅ Accepted by ${interaction.user}`
    : `**Status:** ❌ Denied by ${interaction.user}`;
  const baseDescription = (original?.description || "").replace(/\*\*Status:\*\*.*$/s, "").trim();
  updatedEmbed.setDescription(`${baseDescription}\n${statusLine}`);

  await interaction.update({ embeds: [updatedEmbed], components: [reviewButtons(id, true)] });

  // On accept, grant the matching bot permission too — the Discord role
  // alone is cosmetic and was never enough for isTester()/isAdmin() checks
  // in commands like /pull, /result, /high-result to pass. This keeps
  // accepted applicants able to use their commands without ever needing
  // real Discord Administrator permission.
  if (isAccept) {
    if (application.type === APPLICATION_TYPE_TESTER) addTester(application.discordId);
    if (application.type === APPLICATION_TYPE_STAFF) addAdmin(application.discordId);
  }

  // On accept, auto-assign the matching role in the server.
  let roleWarning = null;
  if (isAccept) {
    const roleId = ROLE_FOR_TYPE[application.type];
    if (!roleId) {
      roleWarning = `⚠️ No role configured for **${meta?.label || application.type}** — set STAFF_ROLE_ID / TESTER_ROLE_ID in .env to auto-assign a role.`;
    } else {
      try {
        const member = await interaction.guild.members.fetch(application.discordId);
        await member.roles.add(roleId);
      } catch (err) {
        console.error("Failed to assign role on accept:", err);
        roleWarning = `⚠️ Accepted, but I couldn't assign the role — check that I have **Manage Roles** and that my role is above <@&${roleId}> in Server Settings > Roles.`;
      }
    }
  }

  if (roleWarning) {
    await interaction.followUp({ content: roleWarning, ephemeral: true }).catch(() => {});
  }

  // DM the applicant with the decision.
  try {
    const applicant = await interaction.client.users.fetch(application.discordId);
    const message = isAccept
      ? `🎉 **Your ${meta?.label.toLowerCase() || "application"} to ${BRAND} has been accepted!** A staff member will follow up with next steps. Congrats!`
      : `📪 **Your ${meta?.label.toLowerCase() || "application"} to ${BRAND} was not accepted this time.** Thanks for applying — feel free to try again in the future.`;
    await applicant.send(message).catch(() => {});
  } catch (err) {
    console.error("Failed to DM applicant with decision:", err);
  }

  return true;
}

async function handleApplicationInteraction(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === APPLICATION_SELECT_ID) {
    await handleApplicationSelect(interaction);
    return true;
  }

  if (
    interaction.isButton() &&
    (interaction.customId.startsWith(APPLICATION_ACCEPT_PREFIX) ||
      interaction.customId.startsWith(APPLICATION_DENY_PREFIX))
  ) {
    return handleApplicationReviewButton(interaction);
  }

  return false;
}

module.exports = { handleApplicationInteraction };
