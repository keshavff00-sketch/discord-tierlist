// ============================================================
// DIFUSED TIERS — bot entry point.
// ============================================================

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const { BRAND } = require("./config");
const { handlePanelInteraction } = require("./utils/panelHandlers");
const { handleApplicationInteraction } = require("./utils/applicationHandlers");

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in."
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // needed to fetch members and assign roles on accept
    GatewayIntentBits.DirectMessages, // needed so awaitMessages() can hear DM replies
    GatewayIntentBits.MessageContent, // needed to read the text of those DM replies
  ],
  partials: [Partials.Channel, Partials.Message], // DM channels arrive partial until fetched
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`⚠️  Skipping ${file}: missing "data.name" export.`);
  }
}

client.once("ready", () => {
  console.log(`✅ ${BRAND} is online as ${client.user.tag}`);
  client.user.setActivity("Minecraft PvP tests | /help");
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    // Select menus / buttons from the /setup application panel
    // (Staff/Tester application picker, and Accept/Deny review buttons).
    if (interaction.isStringSelectMenu() || interaction.isButton()) {
      const handled = await handleApplicationInteraction(interaction);
      if (handled) return;
    }

    // Buttons, select menus, and modals from the /setup panel (waitlist).
    if (
      interaction.isButton() ||
      interaction.isStringSelectMenu() ||
      interaction.isModalSubmit()
    ) {
      await handlePanelInteraction(interaction);
    }
  } catch (err) {
    console.error(`Error handling interaction:`, err);
    const errorReply = {
      content: "❌ Something went wrong running that command.",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply);
    } else if (interaction.isRepliable()) {
      await interaction.reply(errorReply);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
