// ============================================================
// DIFUSED TIERS — /addstaff  (server Administrators only)
// Adds a person to the staff list. Staff show up in the /testers embed
// and get the bot's admin powers (same as an accepted Staff application).
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const { getStaff, addAdmin } = require("../database");
const { STAFF_ROLE_ID } = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addstaff")
    .setDescription("[Admin] Add someone to the staff list (shown in /testers).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The new staff member").setRequired(true)
    ),

  async execute(interaction) {
    const allowed =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.guild?.ownerId === interaction.user.id;
    if (!allowed) {
      return interaction.reply({ content: "❌ Only server Administrators can add staff.", flags: MessageFlags.Ephemeral });
    }

    const user = interaction.options.getUser("user", true);
    if (user.bot) {
      return interaction.reply({ content: "❌ You can't add a bot as staff.", flags: MessageFlags.Ephemeral });
    }
    if (getStaff().admins.includes(user.id)) {
      return interaction.reply({ content: `❌ <@${user.id}> is already staff.`, flags: MessageFlags.Ephemeral });
    }

    addAdmin(user.id);

    // Also give the Discord staff role, if STAFF_ROLE_ID is set in Railway.
    let roleNote = "";
    if (STAFF_ROLE_ID) {
      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(STAFF_ROLE_ID, `Added as staff by ${interaction.user.tag}`);
        roleNote = " They also got the staff role.";
      } catch (err) {
        console.error("[/addstaff] couldn't give staff role:", err.message);
        roleNote = " ⚠️ I couldn't give the staff role (check my role position / permissions).";
      }
    }

    return interaction.reply({
      content: `✅ Added <@${user.id}> as **staff**. They now show up in \`/testers\`.${roleNote}`,
      allowedMentions: { parse: [] },
    });
  },
};
