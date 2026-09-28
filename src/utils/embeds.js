const { EmbedBuilder } = require("discord.js");
const {
  BRAND,
  BRAND_COLOR,
  GAMEMODES,
  TITLES,
  titleForPoints,
  gamemodeByKey,
} = require("../config");
const { totalPoints } = require("../database");
const { headUrl } = require("./mojang");

function profileEmbed(player) {
  const points = totalPoints(player);
  const title = titleForPoints(points);

  const tierLines = GAMEMODES.map((g) => {
    const tier = player.tiers?.[g.key];
    return `${g.emoji} **${g.name}**: ${tier ? `\`${tier}\`` : "_Untested_"}`;
  });

  const embed = new EmbedBuilder()
    .setColor(title.color)
    .setTitle(`${player.ign || "Unknown Player"}'s ${BRAND} Profile`)
    .setDescription(
      `**Rank Title:** ${title.name}\n**Total Points:** ${points}`
    )
    .addFields({
      name: "Gamemode Tiers",
      value: tierLines.join("\n") || "No tiers yet.",
    })
    .setFooter({ text: BRAND })
    .setTimestamp(player.updatedAt || Date.now());

  if (player.uuid) embed.setThumbnail(headUrl(player.uuid));
  if (player.region) embed.addFields({ name: "Region", value: player.region, inline: true });

  return embed;
}

// Posted by /result to the RESULT_CHANNEL_ID channel when a tester
// finishes testing a player. Now includes account type indicator and skin.
const RESULT_EMBED_COLOR = 0xf5c518; // gold

function testResultEmbed({ playerName, uuid, testerId, gamemodeLabel, rankBefore, rankEarned, cracked = false }) {
  const embed = new EmbedBuilder()
    .setColor(RESULT_EMBED_COLOR)
    .setTitle(`${playerName}'s Test Results 🏆`)
    .addFields(
      { name: "Player Name:", value: playerName },
      { name: "Tester Name:", value: `<@${testerId}>` },
      { name: "Rank Before:", value: rankBefore },
      { name: "Rank Earned:", value: rankEarned },
      { name: "Game Mode:", value: gamemodeLabel },
      { name: "Account Type:", value: cracked ? "🔓 Cracked" : "✅ Premium", inline: true }
    )
    .setFooter({ text: BRAND })
    .setTimestamp();

  if (uuid) embed.setThumbnail(headUrl(uuid));

  return embed;
}

function overallLeaderboardEmbed(entries) {
  const embed = new EmbedBuilder()
    .setColor(0x9b5de5)
    .setTitle(`${BRAND} — Overall Leaderboard`)
    .setFooter({ text: BRAND })
    .setTimestamp();

  if (!entries.length) {
    embed.setDescription("No ranked players yet.");
    return embed;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = entries.map((p, i) => {
    const rankIcon = medals[i] || `**#${i + 1}**`;
    const title = titleForPoints(p.points).name;
    return `${rankIcon} **${p.ign || "Unknown"}** — ${p.points} pts (${title})`;
  });

  embed.setDescription(lines.join("\n"));
  return embed;
}

function gamemodeLeaderboardEmbed(gamemodeKey, entries) {
  const gm = gamemodeByKey(gamemodeKey);
  const embed = new EmbedBuilder()
    .setColor(0x9b5de5)
    .setTitle(`${BRAND} — ${gm.emoji} ${gm.name} Leaderboard`)
    .setFooter({ text: BRAND })
    .setTimestamp();

  if (!entries.length) {
    embed.setDescription("No players ranked in this gamemode yet.");
    return embed;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = entries.map((p, i) => {
    const rankIcon = medals[i] || `**#${i + 1}**`;
    const tier = p.tiers[gamemodeKey.toUpperCase()];
    return `${rankIcon} **${p.ign || "Unknown"}** — \`${tier}\` (${p.points} pts)`;
  });

  embed.setDescription(lines.join("\n"));
  return embed;
}

function gamemodesListEmbed() {
  const lines = GAMEMODES.map((g) => `${g.emoji} **${g.name}** (\`${g.key}\`)`);
  return new EmbedBuilder()
    .setColor(0x9b5de5)
    .setTitle(`${BRAND} — Tracked Gamemodes`)
    .setDescription(lines.join("\n"))
    .addFields({
      name: "Tier Scale (best → worst)",
      value: "`HT1` `LT1` `HT2` `LT2` `HT3` `LT3` `HT4` `LT4` `HT5` `LT5`",
    })
    .setFooter({ text: BRAND });
}

// Bundled logo (assets/logo.png) is attached as "attachment://logo.png"
// by whichever command sends the message (see commands/setup.js).
const LOGO_ATTACHMENT_URL = "attachment://logo.png";

function setupPanelEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`📋 Evaluation Testing Waitlist & Roles`)
    .setThumbnail(LOGO_ATTACHMENT_URL)
    .setDescription(
      [
        "**Step 1: Register Your Profile**",
        "Click the **Register / Update Profile** button to set your in-game details.",
        "",
        "**Step 2: Join a Gamemode Waitlist**",
        "After registering, pick a gamemode from the dropdown below to join its waitlist. Each gamemode has a **7-day cooldown**.",
        "",
        "• **Region:** The server region you wish to test on (`NA`, `EU`, `AS/AU`).",
        "• **Username:** The name of the account you will be testing on.",
        "",
        "_Failure to provide authentic information will result in a denied test._",
      ].join("\n")
    )
    .setFooter({ text: BRAND });
}

function queuePanelEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("🎮 Request a Test")
    .setThumbnail(LOGO_ATTACHMENT_URL)
    .setDescription(
      [
        "Pick a gamemode below to join its test queue.",
        "",
        "_Make sure you've already registered your profile — if you haven't, use the **Register / Update Profile** button on the main panel first._",
        "",
        "A tester will `/pull` you from the queue and open a ticket with you when it's your turn.",
      ].join("\n")
    )
    .setFooter({ text: BRAND });
}

// Shown in the private ticket channel /pull creates — the tester's
// at-a-glance view of who they just pulled and what they're testing.
function ticketEmbed(player, gm, entry, tester) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${gm.emoji} ${gm.name} Test — ${player.ign || "Unknown Player"}`)
    .addFields(
      { name: "Discord", value: `<@${player.discordId}>`, inline: true },
      { name: "IGN (testing on)", value: entry.username || player.ign || "—", inline: true },
      { name: "Region", value: entry.region || "—", inline: true },
      { name: "Pulled by", value: `<@${tester.id}>`, inline: true },
      {
        name: "Current Tier",
        value: player.tiers?.[gm.key] ? `\`${player.tiers[gm.key]}\`` : "_Untested_",
        inline: true,
      },
      { name: "Queued", value: `<t:${Math.floor(entry.joinedAt / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: BRAND })
    .setTimestamp();

  // Logo goes in the thumbnail slot (top-right corner). The player's
  // head moves to the small author icon (top-left, next to their name)
  // so both stay visible.
  if (player.uuid) {
    embed.setAuthor({ name: player.ign || "Unknown Player", iconURL: headUrl(player.uuid) });
  }
  embed.setThumbnail(LOGO_ATTACHMENT_URL);

  return embed;
}

// ---------------- Per-gamemode open/closed queue panel (/setup queue) ----------------

function queueClosedEmbed(gm, state) {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`${gm.emoji} ${gm.name} Queue Is Now Closed`)
    .setDescription(
      [
        `**No ${gm.name} Tester Currently Online**`,
        "",
        "This queue has been closed. You will be notified when a new queue is opened.",
      ].join("\n")
    )
    .addFields({
      name: "Session Ended",
      value: `<t:${Math.floor((state?.closedAt || Date.now()) / 1000)}:F>`,
    })
    .setFooter({ text: BRAND })
    .setTimestamp();

  return embed;
}

function queueOpenEmbed(gm, state, entries) {
  const shown = entries.slice(0, 10);
  const list = shown
    .map((e, i) => `${i + 1}. **${e.username}** (${e.region}) — <@${e.discordId}>`)
    .join("\n");
  const extra = entries.length > shown.length ? `\n_+${entries.length - shown.length} more_` : "";

  const embed = new EmbedBuilder()
    .setColor(0x3ba55d)
    .setTitle(`${gm.emoji} ${gm.name} Queue Is Now Open`)
    .setDescription(
      [
        `**${state.openedBy ? `<@${state.openedBy}>` : "A"} Tester Is Online**`,
        "",
        "Click **Join Queue** below to enter, or **Leave Queue** to back out.",
      ].join("\n")
    )
    .addFields(
      { name: "Session Started", value: `<t:${Math.floor(state.openedAt / 1000)}:F>`, inline: false },
      {
        name: `In Queue (${entries.length})`,
        value: entries.length ? `${list}${extra}` : "_Nobody's queued yet — be the first!_",
      }
    )
    .setFooter({ text: BRAND })
    .setTimestamp();

  return embed;
}

function applicationPanelEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle("📋 Tierlist Applications")
    .setThumbnail(LOGO_ATTACHMENT_URL)
    .addFields(
      {
        name: "🛡️ Staff Applications",
        value: [
          "• Must be 15 years old or above",
          "• Moderation experience isn't required, but it does help your chances",
          "• Must be active and able to dedicate 3+ hours a day",
          "• Be professional when handling tickets and in your application",
          "• Be able to follow higher staff's instructions & work as a team",
        ].join("\n"),
      },
      {
        name: "⚔️ Tester Application",
        value: [
          "• Must be 15 years old or above",
          "• Must be active, mature, and unbiased toward every player — not toxic",
          "• Must be ranked LT3 or above (tiers can migrate from other tier lists if you qualify)",
          "• Must be professional when handling tickets",
          "• Must complete the monthly quota of 20 tier tests",
          "• Must follow instructions from higher staff & be able to work in a team",
        ].join("\n"),
      }
    )
    .setFooter({ text: `${BRAND} — Select an application below to begin` });
}

module.exports = {
  profileEmbed,
  testResultEmbed,
  overallLeaderboardEmbed,
  gamemodeLeaderboardEmbed,
  gamemodesListEmbed,
  setupPanelEmbed,
  queuePanelEmbed,
  queueOpenEmbed,
  queueClosedEmbed,
  ticketEmbed,
  applicationPanelEmbed,
};

