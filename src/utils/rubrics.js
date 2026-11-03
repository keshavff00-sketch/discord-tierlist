// ============================================================
// DIFUSED TIERS — Ranked Rubrics panel (how testing works per tier).
//
// /rubrics posts a panel with one button per gamemode. Clicking a button
// shows that gamemode's rubrics ONLY to the person who clicked (ephemeral).
//
// NOTE: Neeche ke score/rounds (First to 10, 5-2, 30-20 etc.) example
// defaults hain. Apne server ke asli rules ke hisaab se RUBRIC_SECTIONS
// me text badal do. Baaki code ko chhedne ki zarurat nahi.
// ============================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { BRAND, BRAND_COLOR, GAMEMODES } = require("../config");

// Button customId prefix (panelHandlers isi se pehchanta hai).
const RUBRIC_BUTTON_PREFIX = "rubric_view:";

// Logo ka attachment (command me assets/logo.png attach hota hai).
const LOGO_ATTACHMENT_URL = "attachment://logo.png";

// ---------------- Sab gamemodes ke liye common rubrics ----------------
// Har section embed me ek field banta hai (name = heading, text = body).
const RUBRIC_SECTIONS = [
  {
    name: "🧪 Unranked / Below HT3",
    text: [
      "Join the waitlist from the **Request Test** panel and wait for a tester to become available.",
      "When a tester opens the queue you will be pinged. Join the queue, and once a tester pulls you, a private testing ticket is opened for you.",
    ].join("\n"),
  },
  {
    name: "⚔️ Testing for HT3",
    text: [
      "**Phase 1:** Do well in your evaluation match against the tester (e.g. a 5-2 score or better) to earn a shot at HT3.",
      "**Phase 2:** You are paired against an HT3 opponent and must beat them in a **First to 10** to receive HT3.",
    ].join("\n"),
  },
  {
    name: "⚔️ Testing for LT2 (FT15)",
    text: [
      "**Phase 1:** Beat two opponents in your current tier. Nobody may get more than 6 rounds on you (First to 10).",
      "**Phase 2:** Get an equal or better score against two players in the tier you are testing for, with a minimum of 10 rounds on each opponent.",
    ].join("\n"),
  },
  {
    name: "⚔️ Testing for HT2 (FT15)",
    text: [
      "**Phase 1:** Beat two opponents in your current tier with an overall score of at least 30-20.",
      "**Phase 2:** Get an equal or better score against two players in the tier you are testing for, with a minimum of 10 rounds on each opponent.",
    ].join("\n"),
  },
  {
    name: "⚔️ Testing for LT1",
    text: [
      "**Phase 1:** Beat two opponents in your current tier with an overall score of at least 30-20.",
      "**Phase 2:** Get an equal or better score against two players in the tier you are testing for, with a minimum of 10 rounds on each opponent.",
    ].join("\n"),
  },
  {
    name: "🏆 Testing for HT1",
    text: [
      "**Phase 1:** Beat two opponents in the tier below you, never letting anyone get more than 10 rounds on you.",
      "**Phase 2:** Get an equal or better score against two players in the tier you are testing for, with a minimum of 10 rounds on each opponent.",
      "**Phase 3:** Beat the current HT1 player. If you win, you take their title.",
    ].join("\n"),
  },
];

// ---------------- Gamemode ke hisaab se extra note (optional) ----------------
// Key wahi jo config.js me hai (CRYSTAL, SWORD, ...). Khali chhodna ho to kuch mat likho.
const EXTRA_NOTES = {
  // NETHPOT: "Netherite potion kit is used for every match.",
  // CRYSTAL: "Standard crystal kit. No auto-crystal / macro mods.",
};

// ---------------- Embeds ----------------

// Public panel (buttons ke saath).
function rubricsPanelEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("📜 Ranked Rubrics")
    .setThumbnail(LOGO_ATTACHMENT_URL)
    .setDescription(
      [
        "Every tier has its own testing requirements. Pick a gamemode below to see how testing works for it, from joining the waitlist all the way up to HT1.",
        "",
        "**Click a gamemode below to view its rubrics.**",
      ].join("\n")
    )
    .setFooter({ text: BRAND });
}

// Gamemode buttons: 5 per row (Discord limit), max 5 rows = 25 gamemodes.
function buildRubricRows() {
  const rows = [];
  for (let i = 0; i < GAMEMODES.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const gm of GAMEMODES.slice(i, i + 5)) {
      const btn = new ButtonBuilder()
        .setCustomId(`${RUBRIC_BUTTON_PREFIX}${gm.key}`)
        .setLabel(gm.name.replace(/\s*PvP$/i, ""))
        .setStyle(ButtonStyle.Secondary);
      if (gm.componentEmoji) btn.setEmoji(gm.componentEmoji);
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows.slice(0, 5);
}

// Ek gamemode ke rubrics (sirf clicker ko dikhte hain).
function rubricEmbed(gm) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${gm.emoji} ${gm.name.replace(/\s*PvP$/i, "")} Rubrics`)
    .addFields(
      RUBRIC_SECTIONS.map((s) => ({ name: s.name, value: s.text.slice(0, 1024) }))
    )
    .setFooter({ text: BRAND })
    .setTimestamp();

  const note = EXTRA_NOTES[gm.key];
  if (note) embed.setDescription(note);

  return embed;
}

module.exports = {
  RUBRIC_BUTTON_PREFIX,
  rubricsPanelEmbed,
  buildRubricRows,
  rubricEmbed,
};
