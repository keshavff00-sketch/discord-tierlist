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
const { TESTER_ROLE_ID, TRIAL_TESTER_ROLE_ID, GAMEMODES } = require("../config");

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

// Per-gamemode permission check, used by /pull and /queue open|close.
//  - Admins can manage every gamemode's queue.
//  - If the member holds ANY gamemode-specific tester role (e.g.
//    SWORD_TESTER_ROLE_ID), they may ONLY manage the gamemodes whose
//    role they hold — even if they also have the general Tester role.
//  - Members with no gamemode-specific role fall back to the normal
//    isTesterMember() check (all gamemodes), so existing setups keep working.
function canManageGamemode(interaction, gamemodeKey) {
  if (interaction.memberPermissions?.has("Administrator")) return true;

  const roles = interaction.member?.roles?.cache;
  if (roles) {
    const gmRoleIds = GAMEMODES.map((g) => g.testerRoleId).filter(Boolean);
    const heldGmRoles = gmRoleIds.filter((id) => roles.has(id));

    if (heldGmRoles.length > 0) {
      const target = GAMEMODES.find((g) => g.key === gamemodeKey.toUpperCase());
      return !!target?.testerRoleId && roles.has(target.testerRoleId);
    }
  }

  return isTesterMember(interaction);
}

module.exports = { isTesterMember, canManageGamemode };
