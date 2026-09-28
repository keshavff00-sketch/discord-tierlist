// ============================================================
// DIFUSED TIERS — slash command deployment.
// Run with: npm run deploy
// ============================================================

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error(
    "❌ Missing DISCORD_TOKEN or CLIENT_ID. Fill in your .env file first."
  );
  process.exit(1);
}

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

const commands = commandFiles.map((file) =>
  require(path.join(commandsPath, file)).data.toJSON()
);

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔁 Deploying ${commands.length} slash commands...`);

    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    await rest.put(route, { body: commands });

    console.log(
      GUILD_ID
        ? `✅ Deployed instantly to guild ${GUILD_ID}.`
        : "✅ Deployed globally (may take up to 1 hour to appear)."
    );
  } catch (err) {
    console.error("❌ Deployment failed:", err);
  }
})();
