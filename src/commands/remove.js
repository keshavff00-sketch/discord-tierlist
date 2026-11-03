// ============================================================
// DIFUSED TIERS — /remove staff, /remove tester
// Admin command: removes someone from the Staff list or the Tester list
// (the lists shown in the staff embed), takes their Discord role(s) away,
// and revokes their accepted application so the bot doesn't re-add them
// on restart. Useful when someone was accepted for the wrong application.
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const {
  GAMEMODES,
  STAFF_ROLE_ID,
  TESTER_ROLE_ID,
  TRIAL_TESTER_ROLE_ID,
} = require("../config");
const { getStaff, isAdmin, removeAdmin, removeTester } = require("../database");

// Kaun-kaun se Discord roles hatane hain (sirf jo set hain).
function staffRoleIds() {
  return [STAFF_ROLE_ID].filter(Boolean);
}

function testerRoleIds() {
  return [
    TESTER_ROLE_ID,
    TRIAL_TESTER_ROLE_ID,
    ...GAMEMODES.map((g) => g.testerRoleId), // per-gamemode tester roles
  ].filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("[Admin] Remove someone from the staff or tester list.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("staff")
        .setDescription("Remove a member from the Staff list (and take their staff role).")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member to remove from staff").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("tester")
        .setDescription("Remove a member from the Tester list (and take their tester roles).")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member to remove from testers").setRequired(true)
        )
    ),

  async execute(interaction) {
    const allowed =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      isAdmin(interaction.user.id);

    if (!allowed) {
      return interaction.reply({
        content: "❌ Only administrators can use this command.",
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser("user", true);
    const isStaffRemoval = sub === "staff";

    await interaction.deferReply({ ephemeral: true });

    // 1) Bot ki list se hatao (aur accepted application revoke hoti hai).
    const before = getStaff();
    const wasListed = isStaffRemoval
      ? before.admins.includes(target.id)
      : before.testers.includes(target.id);

    if (isStaffRemoval) removeAdmin(target.id);
    else removeTester(target.id);

    // 2) Discord role(s) hatao (agar member server me hai).
    const roleIds = isStaffRemoval ? staffRoleIds() : testerRoleIds();
    let removedRoles = [];
    let roleError = false;

    try {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member) {
        const toRemove = roleIds.filter((id) => member.roles.cache.has(id));
        if (toRemove.length) {
          await member.roles.remove(toRemove, `/remove ${sub} by ${interaction.user.tag}`);
          removedRoles = toRemove;
        }
      }
    } catch (err) {
      console.error(`[/remove ${sub}] Failed to remove role(s):`, err.message);
      roleError = true;
    }

    const label = isStaffRemoval ? "Staff" : "Tester";
    const lines = [
      wasListed
        ? `✅ <@${target.id}> has been removed from the **${label}** list.`
        : `ℹ️ <@${target.id}> wasn't in the **${label}** list (nothing to remove there).`,
    ];

    if (removedRoles.length) {
      lines.push(`🎭 Removed role(s): ${removedRoles.map((id) => `<@&${id}>`).join(", ")}`);
    }
    if (roleError) {
      lines.push(
        "⚠️ Couldn't remove their Discord role — check that my role is above it and I have **Manage Roles**."
      );
    }

    return interaction.editReply(lines.join("\n"));
  },
};
