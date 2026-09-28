const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { BRAND } = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all DIFUSED TIERS commands."),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x9b5de5)
      .setTitle(`${BRAND} — Commands`)
      .addFields(
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
            "`/setrank <user> <gamemode> <tier>` — assign a tier\n" +
            "`/removerank <user> <gamemode>` — clear a tier",
        },
        {
          name: "🛡️ Admin",
          value:
            "`/addtester <user>` — grant tester permissions\n" +
            "`/removetester <user>` — revoke tester permissions",
        }
      )
      .setFooter({ text: BRAND });

    return interaction.reply({ embeds: [embed] });
  },
};
