// ============================================================
// DIFUSED TIERS — lightweight JSON file database.
// No native modules required, so it runs anywhere Node.js runs.
// Swap this out for SQLite/Postgres later if you outgrow it.
// ============================================================

const fs = require("fs");
const path = require("path");
const { GAMEMODE_KEYS, tierPoints } = require("./config");

// Test complete hone ke baad us gamemode ka cooldown (12 ghante).
const TEST_COOLDOWN_MS = 12 * 60 * 60 * 1000;

// FIX: Railway volume ke liye DATA_DIR env variable use karo (e.g. /appdata).
// Agar set nahi hai (local PC), to purana ../data folder use hoga.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const PLAYERS_FILE = path.join(DATA_DIR, "players.json");
const TESTERS_FILE = path.join(DATA_DIR, "testers.json");
const WAITLIST_FILE = path.join(DATA_DIR, "waitlist.json");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");
const QUEUE_STATE_FILE = path.join(DATA_DIR, "queueState.json");
const COOLDOWNS_FILE = path.join(DATA_DIR, "cooldowns.json");

console.log(`[database] Using data directory: ${DATA_DIR}`);

function ensureFile(file, fallback) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  }
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// Atomic write: pehle temp file me likho, phir rename. Crash/restart ke
// beech file adhoori likhi reh kar corrupt nahi hogi.
function writeJSON(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

ensureFile(PLAYERS_FILE, {});
ensureFile(TESTERS_FILE, { admins: [], testers: [] });
ensureFile(WAITLIST_FILE, {});
ensureFile(APPLICATIONS_FILE, []);
ensureFile(QUEUE_STATE_FILE, {});
ensureFile(COOLDOWNS_FILE, {});

// ---------------- Players ----------------
// players.json shape:
// { [discordId]: { discordId, ign, uuid, region, tiers: { CRYSTAL: "HT2", ... }, updatedAt } }

function getAllPlayers() {
  return readJSON(PLAYERS_FILE);
}

function getPlayer(discordId) {
  const players = getAllPlayers();
  return players[discordId] || null;
}

function upsertPlayer(discordId, patch) {
  const players = getAllPlayers();
  const existing = players[discordId] || {
    discordId,
    ign: null,
    uuid: null,
    region: null,
    tiers: {},
    updatedAt: Date.now(),
  };
  const merged = { ...existing, ...patch, updatedAt: Date.now() };
  players[discordId] = merged;
  writeJSON(PLAYERS_FILE, players);
  return merged;
}

// Tier/result dete hi (test complete) us gamemode ka 12 ghante ka cooldown
// lag jata hai — sirf usi gamemode ka, baaki gamemodes par koi asar nahi.
function setTier(discordId, gamemodeKey, tier) {
  const players = getAllPlayers();
  const existing =
    players[discordId] ||
    {
      discordId,
      ign: null,
      uuid: null,
      region: null,
      tiers: {},
      updatedAt: Date.now(),
    };
  existing.tiers[gamemodeKey.toUpperCase()] = tier.toUpperCase();
  existing.updatedAt = Date.now();
  players[discordId] = existing;
  writeJSON(PLAYERS_FILE, players);

  setTestCooldown(discordId, gamemodeKey);

  return existing;
}

function removeTier(discordId, gamemodeKey) {
  const players = getAllPlayers();
  const existing = players[discordId];
  if (!existing) return null;
  delete existing.tiers[gamemodeKey.toUpperCase()];
  existing.updatedAt = Date.now();
  players[discordId] = existing;
  writeJSON(PLAYERS_FILE, players);
  return existing;
}

function totalPoints(player) {
  if (!player || !player.tiers) return 0;
  return GAMEMODE_KEYS.reduce((sum, key) => {
    const tier = player.tiers[key];
    return sum + (tier ? tierPoints(tier) : 0);
  }, 0);
}

function overallLeaderboard(limit = 10) {
  const players = Object.values(getAllPlayers());
  return players
    .map((p) => ({ ...p, points: totalPoints(p) }))
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function gamemodeLeaderboard(gamemodeKey, limit = 10) {
  const key = gamemodeKey.toUpperCase();
  const players = Object.values(getAllPlayers());
  return players
    .filter((p) => p.tiers && p.tiers[key])
    .map((p) => ({ ...p, points: tierPoints(p.tiers[key]) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

// ---------------- Test Cooldowns (per player, per gamemode) ----------------
// cooldowns.json shape:
// { [discordId]: { [gamemodeKey]: expiresAtTimestamp } }

function setTestCooldown(discordId, gamemodeKey, ms = TEST_COOLDOWN_MS) {
  const cooldowns = readJSON(COOLDOWNS_FILE);
  const key = gamemodeKey.toUpperCase();
  const existing = cooldowns[discordId] || {};
  existing[key] = Date.now() + ms;
  cooldowns[discordId] = existing;
  writeJSON(COOLDOWNS_FILE, cooldowns);
  return existing[key];
}

// ---------------- Evaluation Testing Waitlist ----------------
// waitlist.json shape:
// { [discordId]: { [gamemodeKey]: { region, username, joinedAt } } }

function getAllWaitlist() {
  return readJSON(WAITLIST_FILE);
}

// Returns remaining cooldown in ms (0 if none / expired).
// Ab sirf test-complete wala cooldown (12h, per gamemode) check hota hai.
function waitlistCooldownRemaining(discordId, gamemodeKey) {
  const cooldowns = readJSON(COOLDOWNS_FILE);
  const expiresAt = cooldowns[discordId]?.[gamemodeKey.toUpperCase()];
  if (!expiresAt) return 0;
  const remaining = expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

function joinWaitlist(discordId, gamemodeKey, { region, username }) {
  const waitlist = getAllWaitlist();
  const key = gamemodeKey.toUpperCase();
  const existing = waitlist[discordId] || {};
  existing[key] = { region, username, joinedAt: Date.now() };
  waitlist[discordId] = existing;
  writeJSON(WAITLIST_FILE, waitlist);
  return existing[key];
}

// Removes and returns the longest-waiting entry for a gamemode's queue
// (FIFO), or null if nobody is queued for it. Used by /pull.
function pullNextFromWaitlist(gamemodeKey) {
  const key = gamemodeKey.toUpperCase();
  const waitlist = getAllWaitlist();

  let bestDiscordId = null;
  let bestEntry = null;
  for (const [discordId, entries] of Object.entries(waitlist)) {
    const entry = entries[key];
    if (!entry) continue;
    if (!bestEntry || entry.joinedAt < bestEntry.joinedAt) {
      bestDiscordId = discordId;
      bestEntry = entry;
    }
  }

  if (!bestDiscordId) return null;

  delete waitlist[bestDiscordId][key];
  if (Object.keys(waitlist[bestDiscordId]).length === 0) {
    delete waitlist[bestDiscordId];
  }
  writeJSON(WAITLIST_FILE, waitlist);

  return { discordId: bestDiscordId, entry: bestEntry };
}

// How many people are currently queued for a gamemode.
function waitlistCount(gamemodeKey) {
  const key = gamemodeKey.toUpperCase();
  const waitlist = getAllWaitlist();
  return Object.values(waitlist).filter((entries) => entries[key]).length;
}

// All entries currently queued for a gamemode, oldest first (FIFO order —
// same order /pull would take them in). Used to render the queue panel.
function waitlistEntries(gamemodeKey) {
  const key = gamemodeKey.toUpperCase();
  const waitlist = getAllWaitlist();
  return Object.entries(waitlist)
    .filter(([, entries]) => entries[key])
    .map(([discordId, entries]) => ({ discordId, ...entries[key] }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

// Voluntarily leave a gamemode's queue (Leave Queue button). Returns
// true if an entry was removed, false if they weren't queued.
function removeFromWaitlist(discordId, gamemodeKey) {
  const key = gamemodeKey.toUpperCase();
  const waitlist = getAllWaitlist();
  if (!waitlist[discordId]?.[key]) return false;

  delete waitlist[discordId][key];
  if (Object.keys(waitlist[discordId]).length === 0) {
    delete waitlist[discordId];
  }
  writeJSON(WAITLIST_FILE, waitlist);
  return true;
}

// Removes EVERYONE from a gamemode's waitlist at once. Used when a
// queue is closed, so the next time it's opened it starts empty instead
// of instantly refilling with whoever never explicitly left last time.
// Returns the discordIds that were removed (so their queue role can
// also be stripped).
function clearWaitlist(gamemodeKey) {
  const key = gamemodeKey.toUpperCase();
  const waitlist = getAllWaitlist();
  const removedIds = [];

  for (const [discordId, entries] of Object.entries(waitlist)) {
    if (!entries[key]) continue;
    removedIds.push(discordId);
    delete entries[key];
    if (Object.keys(entries).length === 0) delete waitlist[discordId];
  }

  if (removedIds.length > 0) writeJSON(WAITLIST_FILE, waitlist);
  return removedIds;
}

// ---------------- Per-gamemode queue open/closed state ----------------
// queueState.json shape:
// { [gamemodeKey]: { open, messageId, channelId, openedBy, openedAt, closedAt } }

function getAllQueueState() {
  return readJSON(QUEUE_STATE_FILE);
}

function getQueueState(gamemodeKey) {
  const state = getAllQueueState();
  return state[gamemodeKey.toUpperCase()] || null;
}

function setQueueState(gamemodeKey, patch) {
  const state = getAllQueueState();
  const key = gamemodeKey.toUpperCase();
  const existing = state[key] || { open: false };
  state[key] = { ...existing, ...patch };
  writeJSON(QUEUE_STATE_FILE, state);
  return state[key];
}

// ---------------- Testers / Admins ----------------

function getStaff() {
  return readJSON(TESTERS_FILE);
}

function isAdmin(discordId) {
  return getStaff().admins.includes(discordId);
}

function isTester(discordId) {
  const staff = getStaff();
  return staff.testers.includes(discordId) || staff.admins.includes(discordId);
}

function addTester(discordId) {
  const staff = getStaff();
  if (!staff.testers.includes(discordId)) staff.testers.push(discordId);
  writeJSON(TESTERS_FILE, staff);
  return staff;
}

function removeTester(discordId) {
  const staff = getStaff();
  staff.testers = staff.testers.filter((id) => id !== discordId);
  writeJSON(TESTERS_FILE, staff);
  return staff;
}

function addAdmin(discordId) {
  const staff = getStaff();
  if (!staff.admins.includes(discordId)) staff.admins.push(discordId);
  writeJSON(TESTERS_FILE, staff);
  return staff;
}

function removeAdmin(discordId) {
  const staff = getStaff();
  staff.admins = staff.admins.filter((id) => id !== discordId);
  writeJSON(TESTERS_FILE, staff);

  // Warna syncAcceptedApplications restart pe dobara admin bana dega
  const applications = readJSON(APPLICATIONS_FILE);
  let changed = false;
  for (const app of applications) {
    if (app.discordId === discordId && app.type === "staff" && app.status === "accepted") {
      app.status = "revoked";
      changed = true;
    }
  }
  if (changed) writeJSON(APPLICATIONS_FILE, applications);

  return staff;
}

// ---------------- Staff / Tester Applications ----------------
// applications.json shape: array of
// { discordId, discordTag, type, answers: [{question, answer}], submittedAt }

function saveApplication(entry) {
  const applications = readJSON(APPLICATIONS_FILE);
  applications.push(entry);
  writeJSON(APPLICATIONS_FILE, applications);
  return entry;
}

function getApplications() {
  return readJSON(APPLICATIONS_FILE);
}

function getApplicationById(id) {
  const applications = readJSON(APPLICATIONS_FILE);
  return applications.find((a) => a.id === id) || null;
}

// patch e.g. { status: "accepted", reviewedBy, reviewedAt }
function updateApplicationStatus(id, patch) {
  const applications = readJSON(APPLICATIONS_FILE);
  const idx = applications.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  applications[idx] = { ...applications[idx], ...patch };
  writeJSON(APPLICATIONS_FILE, applications);
  return applications[idx];
}

// Backfill: applications accepted before acceptance started granting
// testers.json permissions get synced here. Safe to call every boot —
// addTester/addAdmin are idempotent.
function syncAcceptedApplications() {
  const applications = readJSON(APPLICATIONS_FILE);
  for (const app of applications) {
    if (app.status !== "accepted") continue;
    if (app.type === "tester") addTester(app.discordId);
    if (app.type === "staff") addAdmin(app.discordId);
  }
}

module.exports = {
  getAllPlayers,
  getPlayer,
  upsertPlayer,
  setTier,
  removeTier,
  totalPoints,
  overallLeaderboard,
  gamemodeLeaderboard,
  getAllWaitlist,
  waitlistCooldownRemaining,
  setTestCooldown,
  joinWaitlist,
  pullNextFromWaitlist,
  waitlistCount,
  waitlistEntries,
  removeFromWaitlist,
  clearWaitlist,
  getQueueState,
  setQueueState,
  getStaff,
  isAdmin,
  isTester,
  addTester,
  removeTester,
  addAdmin,
  removeAdmin,
  saveApplication,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  syncAcceptedApplications,
};
