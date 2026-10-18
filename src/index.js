// ============================================================
// DIFUSED TIERS — bot entry point.
// ============================================================

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  MessageFlags,
} = require("discord.js");
const { BRAND } = require("./config");
const { handlePanelInteraction } = require("./utils/panelHandlers");
const { handleApplicationInteraction } = require("./utils/applicationHandlers");
const { setupInviteTracker } = require("./utils/inviteTracker");

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
    GatewayIntentBits.GuildInvites, // needed by the invite tracker to see invite use-counts
    GatewayIntentBits.GuildMessages, // needed so the bot can see "-i" typed in server channels
    GatewayIntentBits.DirectMessages, // needed so awaitMessages() can hear DM replies
    GatewayIntentBits.MessageContent, // needed to read the text of those DM replies
  ],
  partials: [Partials.Channel, Partials.Message], // DM channels arrive partial until fetched
});

setupInviteTracker(client); // posts "@user invited @member and has N invites"

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command?.data?.name) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`⚠️  Skipping ${file}: missing "data.name" export.`);
    }
  } catch (err) {
    console.error(`❌ Failed to load command ${file}:`, err);
  }
}

// Bot start hote hi saari slash commands Discord me apne aap register ho jati hain.
async function registerCommands() {
  const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;
  const clientId = CLIENT_ID || client.user.id;

  const body = [...client.commands.values()].map((c) => c.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(clientId, GUILD_ID)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body });
  console.log(`✅ Auto-registered ${body.length} commands${GUILD_ID ? ` to guild ${GUILD_ID}` : " globally"}.`);
}

client.once("clientReady", async () => {
  console.log(`✅ ${BRAND} is online as ${client.user.tag}`);
  client.user.setActivity("Minecraft PvP tests | /help");

  try {
    await registerCommands();
  } catch (err) {
    console.error("❌ Auto-register failed:", err);
  }
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
      flags: MessageFlags.Ephemeral,
    };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply);
      } else if (interaction.isRepliable()) {
        await interaction.reply(errorReply);
      }
    } catch (e) {
      console.error("Failed to send error reply:", e);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
