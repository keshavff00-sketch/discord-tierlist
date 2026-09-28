# DIFUSED TIERS

A MCTiers / PvPTiers-style Minecraft PvP tier-testing Discord bot, built with
[discord.js](https://discord.js.org) v14. Tracks player tiers across
PvP gamemodes, computes an overall score and rank title, and posts
leaderboards — all backed by a dependency-free JSON file store (no
native modules to compile, no external database to host).

## Features

- `/register` — players link their Minecraft IGN (resolved via the Mojang API)
- `/profile` — a tier card showing every gamemode, points, and rank title
- `/setrank` / `/removerank` — testers assign or clear a player's tier per gamemode
- `/leaderboard` — overall or per-gamemode rankings
- `/gamemodes` — lists every tracked gamemode and the tier scale
- `/testers`, `/addtester`, `/removetester` — staff management
- `/help` — command reference

### Tracked gamemodes

Crystal PvP · Sword PvP · Axe PvP · Mace PvP · Pot PvP · NethPot PvP · UHC PvP · SMP PvP

Add or remove gamemodes any time in `src/config.js` — nothing else needs to change.

### Tier scale

`HT1` `LT1` `HT2` `LT2` `HT3` `LT3` `HT4` `LT4` `HT5` `LT5` (High/Low Tier 1 = best).

Point values and rank-title thresholds also live in `src/config.js`.

## Setup

1. **Create a Discord application & bot**
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications) → New Application.
   - Under **Bot**, click "Reset Token" and copy it.
   - Under **OAuth2 → General**, copy the **Application (Client) ID**.
   - Under **OAuth2 → URL Generator**, check `bot` and `applications.commands`,
     give it `Send Messages` and `Embed Links`, and use the generated URL to invite it to your server.

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `DISCORD_TOKEN`, `CLIENT_ID`, and (optionally, for instant command
   updates while testing) `GUILD_ID`.

4. **Deploy slash commands**
   ```bash
   npm run deploy
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

6. **Make yourself an admin**
   The first admin has to be set manually since no one starts with permissions.
   Open `data/testers.json` after the bot's first run and add your Discord user ID:
   ```json
   { "admins": ["YOUR_DISCORD_ID"], "testers": [] }
   ```
   Restart the bot. From there, use `/addtester` to add more staff — anyone with
   the server's **Administrator** permission can also use tester/admin commands.

## Data storage

Player and staff data live in `data/players.json` and `data/testers.json`.
Back these up if you redeploy the bot elsewhere. For larger servers, swap
`src/database.js` for a real database (SQLite/Postgres) — every other file
calls it through the same small function API, so nothing else needs to change.

## Project structure

```
src/
  index.js            bot entry point
  deploy-commands.js  registers slash commands with Discord
  config.js           gamemodes, tiers, points, titles
  database.js         JSON file persistence layer
  utils/
    mojang.js          Minecraft username → UUID lookup
    embeds.js           embed builders
  commands/            one file per slash command
data/
  players.json         player tier data (created on first run)
  testers.json          staff list (created on first run)
```
