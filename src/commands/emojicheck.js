// ============================================================
// DIFUSED TIERS — /emojicheck  (admins only)
// Shows exactly why custom emojis do or don't appear:
//  - are the IDs in config.js really inside THIS bot's application?
//  - what do the emojis look like when the bot sends them?
// ============================================================

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { isAdmin } = require("../database");
const { GAMEMODES, EMOJI } = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("emojicheck")
    .setDescription("[Admin] Check why the custom gamemode emojis aren't showing."),

  async execute(interaction) {
    if (!isAdmin(interaction.user.id)) {
      return interaction.reply({ content: "❌ Only admins can use this.", flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const app = interaction.client.application;
    const manager = app?.emojis;

    let appEmojis = null;
    let problem = null;
    if (!manager?.fetch) {
      problem = "Your discord.js version is too old for application emojis. Run `npm install discord.js@latest`.";
    } else {
      try {
        appEmojis = await manager.fetch();
      } catch (err) {
        problem = `Couldn't fetch this bot's application emojis: ${err.message}`;
      }
    }

    const header = [
      `**Bot application ID:** \`${app?.id}\``,
      `**CLIENT_ID in env:** \`${process.env.CLIENT_ID || "not set"}\``,
      appEmojis ? `**Emojis uploaded to this bot:** ${appEmojis.size}` : `⚠️ ${problem}`,
      "",
    ];

    const lines = GAMEMODES.map((gm) => {
      const cfg = EMOJI[gm.key];
      let status;
      if (!cfg?.id) status = "⚠️ no ID in config.js (normal emoji used)";
      else if (!appEmojis) status = "❓ couldn't verify";
      else if (appEmojis.has(cfg.id)) status = `✅ found in this bot (\`${appEmojis.get(cfg.id).name}\`)`;
      else status = "❌ this ID does NOT exist in this bot";
      return `${gm.emoji} **${gm.key}** — ${status}`;
    });

    await interaction.editReply([...header, ...lines].join("\n").slice(0, 1990));

    if (appEmojis?.size) {
      const list = [...appEmojis.values()].map((e) => `${e.name} — ${e.id}`).join("\n");
      await interaction.followUp({
        content: `**Emojis that really exist in this bot (name — ID):**\n\`\`\`\n${list.slice(0, 1800)}\n\`\`\``,
        flags: MessageFlags.Ephemeral,
      });
    } else if (appEmojis) {
      await interaction.followUp({
        content:
          "This bot has **0 emojis**. They were uploaded to a different application than the one whose token the bot uses. Upload them in the Developer Portal → *your bot's app* → **Emojis**, then put the new IDs in `config.js`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
