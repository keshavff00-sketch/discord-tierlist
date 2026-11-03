// ============================================================
// DIFUSED TIERS — Ruleset panel (allowed / banned mods per gamemode).
//
// /ruleset posts a panel with one button per gamemode. Clicking a button
// shows that gamemode's ruleset ONLY to the person who clicked (ephemeral).
//
// Rules badalne ke liye sirf is file ki lists edit karo, baaki code ko
// chhedne ki zarurat nahi.
// ============================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { BRAND, BRAND_COLOR, GAMEMODES } = require("../config");

// Button customId prefix (panelHandlers isi se pehchanta hai).
const RULESET_BUTTON_PREFIX = "ruleset_view:";

// Logo ka attachment (command me assets/logo.png attach hota hai).
const LOGO_ATTACHMENT_URL = "attachment://logo.png";

// ---------------- Mods: sab gamemodes ke liye common ----------------

const ALLOWED_MODS = [
  "Armor HUD / Potion HUD",
  "Health Indicators",
  "Saturation HUD",
  "Performance Mods (FPS boosters)",
  "Texture packs that don't give an advantage (cosmetic only)",
  "Durability viewer texture packs",
];

const BANNED_MODS = [
  "X-ray (mods or texture packs)",
  "Freecam",
  "Auto Jump Reset",
  "Anything that modifies your game latency (KB delay)",
  "Fast XP",
  "Any private mod that provides an advantage",
  "Any mod that is not publicly released and gives an unfair advantage",
];

// ---------------- Gamemode ke hisaab se alag rules (optional) ----------------
// Key wahi jo config.js me hai (CRYSTAL, SWORD, ...). Kuch nahi likhna to khali chhod do.
//
// KIT_RULES   : us gamemode ka kit/fight rule (embed ke upar dikhega)
// EXTRA_ALLOWED / EXTRA_BANNED : sirf us gamemode ke extra mods
const KIT_RULES = {
  // CRYSTAL: "• Totems allowed\n• No pearl spam",
  // NETHPOT: "• Standard netherite pot kit",
};

const EXTRA_ALLOWED = {
  // NETHPOT: ["Armor durability HUD"],
};

const EXTRA_BANNED = {
  // CRYSTAL: ["Auto crystal / macro mods"],
};

// ---------------- Embeds ----------------

function bullets(list) {
  return list.map((m) => `• ${m}`).join("\n");
}

// Public panel (buttons ke saath).
function rulesetPanelEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("⚔️ Tierlist Kit Ruleset")
    .setThumbnail(LOGO_ATTACHMENT_URL)
    .setDescription(
      [
        "Tierlist rules are applied to every tierlist fight to keep things fair and give every player the same advantages.",
        "",
        "Any advanced modification or exploitation of bugs that gives an unfair advantage over your opponent is considered cheating, and you will be restricted from tierlist fights if caught.",
        "",
        "**Click a gamemode below to see its allowed and banned mods.**",
      ].join("\n")
    )
    .setFooter({ text: BRAND });
}

// Gamemode buttons: 5 per row (Discord limit), max 5 rows = 25 gamemodes.
function buildRulesetRows() {
  const rows = [];
  for (let i = 0; i < GAMEMODES.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const gm of GAMEMODES.slice(i, i + 5)) {
      const btn = new ButtonBuilder()
        .setCustomId(`${RULESET_BUTTON_PREFIX}${gm.key}`)
        .setLabel(gm.name.replace(/\s*PvP$/i, ""))
        .setStyle(ButtonStyle.Secondary);
      if (gm.componentEmoji) btn.setEmoji(gm.componentEmoji);
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows.slice(0, 5);
}

// Ek gamemode ka ruleset (sirf clicker ko dikhta hai).
function rulesetEmbed(gm) {
  const allowed = [...ALLOWED_MODS, ...(EXTRA_ALLOWED[gm.key] || [])];
  const banned = [...BANNED_MODS, ...(EXTRA_BANNED[gm.key] || [])];
  const kit = KIT_RULES[gm.key];

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${gm.emoji} ${gm.name} Ruleset`)
    .addFields(
      { name: "✅ Allowed Mods", value: bullets(allowed).slice(0, 1024) },
      { name: "❌ Banned Mods", value: bullets(banned).slice(0, 1024) }
    )
    .setFooter({ text: BRAND })
    .setTimestamp();

  if (kit) embed.setDescription(`**Kit Rules**\n${kit}`);

  return embed;
}

module.exports = {
  RULESET_BUTTON_PREFIX,
  rulesetPanelEmbed,
  buildRulesetRows,
  rulesetEmbed,
};
