// ============================================================
// DIFUSED TIERS — core configuration
// Gamemodes, tier codes, point values, and rank titles.
// ============================================================

const path = require("path");

const BRAND = "DIFUSED TIERS";
const BRAND_COLOR = 0x9b5de5; // accent color used across embeds

// The bundled server logo, shown as the thumbnail on panel embeds
// (/setup panel and /setup application). To change it, just replace
// assets/logo.png with your own image — no code changes needed.
const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");

// Legacy: a URL-based icon, kept as a fallback / for future use.
// Set BRAND_ICON_URL in your .env to override.
const BRAND_ICON =
  process.env.BRAND_ICON_URL ||
  "https://crafatar.com/avatars/8667ba71-b85a-4004-af54-457a9734eed7?overlay"; // placeholder head

// Channel where completed Staff/Tester applications get posted for review.
// Set APPLICATION_LOG_CHANNEL_ID in your .env to the channel ID.
const APPLICATION_LOG_CHANNEL_ID = process.env.APPLICATION_LOG_CHANNEL_ID || null;

// Channel where /result posts a player's test-result card. Set
// RESULT_CHANNEL_ID in your .env to the channel ID (right-click the
// channel -> Copy Channel ID, needs Developer Mode on).
const RESULT_CHANNEL_ID = process.env.RESULT_CHANNEL_ID || null;

// Separate channel where /high-result posts HT3-and-above result cards.
// Set HIGH_RESULT_CHANNEL_ID in your .env to that channel's ID.
const HIGH_RESULT_CHANNEL_ID = process.env.HIGH_RESULT_CHANNEL_ID || null;

// Category under which /pull creates private ticket channels. Set
// TICKET_CATEGORY_ID in your .env to a category's ID (right-click the
// category -> Copy Channel ID). Leave empty to create tickets at the
// top level of the server instead.
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || null;

// Roles auto-assigned when an application is Accepted. Set STAFF_ROLE_ID /
// TESTER_ROLE_ID in your .env to the role IDs (right-click the role in
// Server Settings -> Roles -> Copy Role ID, needs Developer Mode on).
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || null;
const TESTER_ROLE_ID = process.env.TESTER_ROLE_ID || null;

// A second tester-tier role (e.g. "Trial Tester") that should also be
// able to use tester commands (/pull, /result, /high-result, /setrank,
// etc.) alongside the main TESTER_ROLE_ID role. Set
// TRIAL_TESTER_ROLE_ID in your .env to that role's ID.
const TRIAL_TESTER_ROLE_ID = process.env.TRIAL_TESTER_ROLE_ID || null;

// Whether /register and the panel's Register button accept cracked
// (offline-mode) Minecraft accounts, not just premium ones. Set
// ALLOW_CRACKED_ACCOUNTS=false in your .env to require premium only.
const ALLOW_CRACKED_ACCOUNTS =
  (process.env.ALLOW_CRACKED_ACCOUNTS || "true").toLowerCase() === "true";

// All tracked PvP gamemodes (this is where new gamemodes get added).
// Each gamemode can have a "queue" role auto-assigned to a player the
// moment they join that gamemode's waitlist. Set <KEY>_QUEUE_ROLE_ID in
// your .env (e.g. NETHPOT_QUEUE_ROLE_ID) to enable it for that gamemode;
// leave it unset to skip role-assignment for that gamemode.
const GAMEMODES_BASE = [
  { key: "CRYSTAL", name: "Crystal PvP", emoji: "💎" },
  { key: "SWORD", name: "Sword PvP", emoji: "⚔️" },
  { key: "AXE", name: "Axe PvP", emoji: "🪓" },
  { key: "MACE", name: "Mace PvP", emoji: "🔨" }, // newest 1.21 weapon gamemode
  { key: "POT", name: "Pot PvP", emoji: "🧪" },
  { key: "NETHPOT", name: "NethPot PvP", emoji: "🔥" },
  { key: "UHC", name: "UHC PvP", emoji: "❤️" },
  { key: "SMP", name: "SMP PvP", emoji: "🌍" },
];

// Each gamemode can also have its own "tester" role (e.g. SWORD_TESTER_ROLE_ID).
// If set, only members with that role (or Administrators) can /pull from
// that gamemode's queue. If unset, /pull falls back to the general tester check.
const GAMEMODES = GAMEMODES_BASE.map((g) => ({
  ...g,
  queueRoleId: process.env[`${g.key}_QUEUE_ROLE_ID`] || null,
  testerRoleId: process.env[`${g.key}_TESTER_ROLE_ID`] || null,
}));

const GAMEMODE_KEYS = GAMEMODES.map((g) => g.key);

// Regions offered on the evaluation testing waitlist panel.
const REGIONS = ["NA", "EU", "AS/AU"];

const WAITLIST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function normalizeRegion(input) {
  const v = input.trim().toUpperCase();
  if (v === "NA") return "NA";
  if (v === "EU") return "EU";
  if (v === "AS/AU" || v === "AS" || v === "AU" || v === "AS_AU") return "AS/AU";
  return null;
}

// Ordered from best to worst.
const TIERS = [
  "HT1",
  "LT1",
  "HT2",
  "LT2",
  "HT3",
  "LT3",
  "HT4",
  "LT4",
  "HT5",
  "LT5",
];

// Points awarded per tier (summed across a player's best tier in each
// gamemode to produce their overall DIFUSED TIERS score).
const TIER_POINTS = {
  HT1: 150,
  LT1: 130,
  HT2: 100,
  LT2: 80,
  HT3: 60,
  LT3: 40,
  HT4: 25,
  LT4: 15,
  HT5: 8,
  LT5: 3,
};

// Overall rank titles, evaluated from highest threshold down.
const TITLES = [
  { name: "Combat Grandmaster", min: 500, color: 0xff3b3b },
  { name: "Combat Master", min: 400, color: 0xff8c42 },
  { name: "Combat Ace", min: 300, color: 0xffd23f },
  { name: "Combat Specialist", min: 200, color: 0x7bd389 },
  { name: "Combat Cadet", min: 100, color: 0x4ea8de },
  { name: "Combat Novice", min: 50, color: 0x9b5de5 },
  { name: "Rookie", min: 0, color: 0x8d99ae },
];

// Split of TIERS used by /result and /high-result, so the two commands
// cover non-overlapping halves of the tier list: HT3 and everything
// better goes through /high-result, LT3 and everything worse goes
// through /result.
const HIGH_TIERS = TIERS.slice(0, TIERS.indexOf("HT3") + 1); // HT1, LT1, HT2, LT2, HT3
const LOW_TIERS = TIERS.slice(TIERS.indexOf("LT3")); // LT3, HT4, LT4, HT5, LT5

function tierPoints(tier) {
  return TIER_POINTS[tier] ?? 0;
}

function titleForPoints(points) {
  for (const t of TITLES) {
    if (points >= t.min) return t;
  }
  return TITLES[TITLES.length - 1];
}

function isValidGamemode(key) {
  return GAMEMODE_KEYS.includes(key.toUpperCase());
}

function isValidTier(tier) {
  return TIERS.includes(tier.toUpperCase());
}

function gamemodeByKey(key) {
  return GAMEMODES.find((g) => g.key === key.toUpperCase());
}

module.exports = {
  BRAND,
  BRAND_COLOR,
  BRAND_ICON,
  LOGO_PATH,
  APPLICATION_LOG_CHANNEL_ID,
  RESULT_CHANNEL_ID,
  HIGH_RESULT_CHANNEL_ID,
  TICKET_CATEGORY_ID,
  STAFF_ROLE_ID,
  TESTER_ROLE_ID,
  TRIAL_TESTER_ROLE_ID,
  ALLOW_CRACKED_ACCOUNTS,
  GAMEMODES,
  GAMEMODE_KEYS,
  REGIONS,
  WAITLIST_COOLDOWN_MS,
  normalizeRegion,
  TIERS,
  HIGH_TIERS,
  LOW_TIERS,
  TIER_POINTS,
  TITLES,
  tierPoints,
  titleForPoints,
  isValidGamemode,
  isValidTier,
  gamemodeByKey,
};
