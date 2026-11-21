// ============================================================
// DIFUSED TIERS — active tests (who is being tested by whom right now).
// Stored in its own small JSON file, so database.js is untouched.
// ============================================================

const fs = require("fs");
const path = require("path");

// Same location logic as database.js (database.js lives next to the utils folder).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "activeTests.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}

function save(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, FILE);
}

// Called by /pull right after the ticket channel is created.
function addActiveTest({ gamemode, playerId, testerId, channelId }) {
  const list = load().filter((t) => t.channelId !== channelId);
  list.push({
    gamemode: String(gamemode).toUpperCase(),
    playerId,
    testerId,
    channelId,
    startedAt: Date.now(),
  });
  save(list);
}

// Active tests of one gamemode, oldest first (used by the queue panel).
function activeTestsFor(gamemode) {
  const key = String(gamemode).toUpperCase();
  return load()
    .filter((t) => t.gamemode === key)
    .sort((a, b) => a.startedAt - b.startedAt);
}

// Called when a ticket is closed. Returns the removed test (or null).
function removeByChannel(channelId) {
  const list = load();
  const found = list.find((t) => t.channelId === channelId);
  if (!found) return null;
  save(list.filter((t) => t.channelId !== channelId));
  return found;
}

// Drops tests whose ticket channel was deleted by hand.
function pruneMissing(guild, gamemode) {
  const key = String(gamemode).toUpperCase();
  const list = load();
  const keep = list.filter((t) => t.gamemode !== key || guild.channels.cache.has(t.channelId));
  if (keep.length !== list.length) save(keep);
}

module.exports = { addActiveTest, activeTestsFor, removeByChannel, pruneMissing };
