// ============================================================
// DIFUSED TIERS — shared tester/admin permission check.
// Used by every tester-only command (/pull, /result, /high-result,
// /setrank, /removerank, /queue open|close, application review).
//
// A member counts as a tester if ANY of these are true:
//  - They have real Discord Administrator permission.
//  - They're in data/testers.json (added via /addtester, or auto-synced
//    when a Staff/Tester application is accepted).
//  - They hold the TESTER_ROLE_ID role in Discord.
//  - They hold the TRIAL_TESTER_ROLE_ID role in Discord (a second,
//    lower tester tier — e.g. "Trial Tester" — that should have the
//    same command access as the main "Tester" role).
// ============================================================

const { isTester } = require("../database");
const { TESTER_ROLE_ID, TRIAL_TESTER_ROLE_ID } = require("../config");

function isTesterMember(interaction) {
  if (interaction.memberPermissions?.has("Administrator")) return true;
  if (isTester(interaction.user.id)) return true;

  const roles = interaction.member?.roles?.cache;
  if (roles) {
    if (TESTER_ROLE_ID && roles.has(TESTER_ROLE_ID)) return true;
    if (TRIAL_TESTER_ROLE_ID && roles.has(TRIAL_TESTER_ROLE_ID)) return true;
  }

  return false;
}

// Gamemode-specific check, used by /pull. If the gamemode has its own
// tester role (<KEY>_TESTER_ROLE_ID), ONLY that role (or an Administrator)
// passes — the general Tester / Trial Tester roles do NOT. If the gamemode
// has no dedicated role configured, it falls back to isTesterMember().
function canTestGamemode(interaction, gm) {
  if (interaction.memberPermissions?.has("Administrator")) return true;
  if (gm?.testerRoleId) {
    return Boolean(interaction.member?.roles?.cache?.has(gm.testerRoleId));
  }
  return isTesterMember(interaction);
}

module.exports = { isTesterMember, canTestGamemode };
