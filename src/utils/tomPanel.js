const { EmbedBuilder, AttachmentBuilder, MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { BRAND, BRAND_COLOR, LOGO_PATH } = require("../config");

const TOM_LOGO = path.join(__dirname, "..", "..", "assets", "tom-logo.png");

async function postTomPanel(interaction) {
  const user = interaction.options.getUser("user", true);
  const note = interaction.options.getString("note");

  const logoPath = fs.existsSync(TOM_LOGO) ? TOM_LOGO : LOGO_PATH;
  const logo = new AttachmentBuilder(logoPath, { name: "tom-logo.png" });

  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  let description =
    `Congratulations <@${user.id}>! 🎉\n\n` +
    `You have been selected as the **Tester of the Month** for **${month}**.\n` +
    `Thank you for your dedication, professionalism and hard work in keeping our tier tests fair and active.`;

  if (note) description += `\n\n> ${note}`;

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: BRAND, iconURL: "attachment://tom-logo.png" })
    .setTitle(`🏆 Tester of the Month — ${month}`)
    .setDescription(description)
    .setThumbnail(user.displayAvatarURL({ size: 256, extension: "png" }))
    .addFields({ name: "Tester", value: `<@${user.id}>`, inline: true })
    .setFooter({ text: BRAND })
    .setTimestamp();

  await interaction.channel.send({
    content: `<@${user.id}>`,
    embeds: [embed],
    files: [logo],
  });

  return interaction.reply({
    content: "✅ Tester of the Month panel posted in this channel.",
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { postTomPanel };
