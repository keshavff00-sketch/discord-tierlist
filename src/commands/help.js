const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { BRAND } = require("../config");

// Jo commands upar category me manually likhi hain, unke naam (More section me dobara nahi aayengi)
const LISTED = new Set([
  "register", "profile", "leaderboard", "gamemodes", "testers",
  "setrank", "removerank", "result", "high-result",
  "addtester", "removetester", "help",
]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all DIFUSED TIERS commands."),

  async execute(interaction) {
    const fields = [
      {
        name: "👤 Player",
        value:
          "`/register <ign>` — link your Minecraft account\n" +
          "`/profile [user]` — view a tier profile\n" +
          "`/leaderboard [gamemode]` — view rankings\n" +
          "`/gamemodes` — list tracked gamemodes\n" +
          "`/testers` — list staff",
      },
      {
        name: "🧪 Tester",
        value:
          "`/result` — post result + give role (LT3 and below)\n" +
          "`/high-result` — post result + give role (HT3 and above)\n" +
          "`/setrank <user> <gamemode> <tier>` — assign a tier + role\n" +
          "`/removerank <user> <gamemode>` — clear a tier",
      },
      {
        name: "🛡️ Admin",
        value:
          "`/addtester <user>` — grant tester permissions\n" +
          "`/removetester <user>` — revoke tester permissions",
      },
    ];

    // Baaki commands automatically (agar bot ne commands client.commands me rakhi hain)
    const registry = interaction.client.commands;
    if (registry && typeof registry.values === "function") {
      const lines = [];
      for (const cmd of registry.values()) {
        const name = cmd?.data?.name;
        if (!name || LISTED.has(name)) continue;
        const desc = cmd.data.description || "";
        lines.push(`\`/${name}\` — ${desc}`);
      }
      if (lines.length) {
        let value = lines.join("\n");
        if (value.length > 1024) value = value.slice(0, 1020) + "...";
        fields.push({ name: "📌 More", value });
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b5de5)
      .setTitle(`${BRAND} — Commands`)
      .addFields(fields)
      .setFooter({ text: BRAND });

    return interaction.reply({ embeds: [embed] });
  },
};
