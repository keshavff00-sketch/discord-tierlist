// ============================================================
// DIFUSED TIERS — invite tracker.
//
// 1. Posts "@inviter invited @member and has N invites" whenever someone
//    joins the server through an invite link.
// 2. "-i" (or "-i @user" / "-i <user id>") shows an invite card:
//    Joins / Left for that person.
//
// How it works: Discord doesn't say which invite a new member used, so
// we keep a snapshot of every invite's use-count and, when a member
// joins, see which invite's count went up.
//
// Needs: Guilds, GuildMembers, GuildInvites, GuildMessages and
// MessageContent intents, and the bot's "Manage Server" permission (to
// read the invite list). Optional env var INVITE_LOG_CHANNEL_ID picks
// the channel for join announcements; otherwise the server's system
// channel is used.
// ============================================================

const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");
const config = require("../config");

const EMBED_COLOR = config.BRAND_COLOR ?? 0x5865f2;
const FOOTER_TEXT = config.BRAND ?? "Invites";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const INVITES_FILE = path.join(DATA_DIR, "invites.json");

// guildId -> Map(code -> { uses, maxUses, inviterId })
const cache = new Map();
// guildId -> promise chain, so simultaneous joins/leaves are processed
// one at a time (otherwise two joins can both "see" the same invite jump).
const queues = new Map();

// ---------------- storage ----------------
// { guildId: { inviterId: { invited: [memberIds], left: [memberIds] } } }
//   invited = everyone who joined through this person's invites
//   left    = the ones from that list who have since left the server

function load() {
  try {
    return JSON.parse(fs.readFileSync(INVITES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INVITES_FILE, JSON.stringify(data, null, 2));
}

function statsOf(entry) {
  const joins = entry?.invited?.length ?? 0;
  const left = entry?.left?.length ?? 0;
  return { joins, left, invites: joins - left };
}

// A member counts toward ONE inviter. If they come back through a
// different person's link, they move over to that person.
// Returns the inviter's current invite count (joins minus left).
function recordInvite(guildId, inviterId, inviteeId) {
  const data = load();
  const guildData = (data[guildId] ??= {});

  for (const [otherId, other] of Object.entries(guildData)) {
    if (otherId === inviterId) continue;
    other.invited = (other.invited || []).filter((id) => id !== inviteeId);
    other.left = (other.left || []).filter((id) => id !== inviteeId);
  }

  const entry = (guildData[inviterId] ??= { invited: [], left: [] });
  entry.invited ??= [];
  entry.left ??= [];
  if (!entry.invited.includes(inviteeId)) entry.invited.push(inviteeId);
  entry.left = entry.left.filter((id) => id !== inviteeId); // they're back

  save(data);
  return statsOf(entry).invites;
}

// Someone we tracked left the server: count it against their inviter.
function recordLeave(guildId, memberId) {
  const data = load();
  const guildData = data[guildId] || {};
  for (const entry of Object.values(guildData)) {
    if (!entry.invited?.includes(memberId)) continue;
    entry.left ??= [];
    if (!entry.left.includes(memberId)) entry.left.push(memberId);
    save(data);
    return;
  }
}

// A tracked member rejoined but we couldn't tell which invite they used:
// keep their old inviter, just stop counting them as having left.
function markReturned(guildId, memberId) {
  const data = load();
  const guildData = data[guildId] || {};
  let changed = false;
  for (const entry of Object.values(guildData)) {
    if (entry.left?.includes(memberId)) {
      entry.left = entry.left.filter((id) => id !== memberId);
      changed = true;
    }
  }
  if (changed) save(data);
}

function getStats(guildId, userId) {
  return statsOf(load()[guildId]?.[userId]);
}

// ---------------- invite snapshots ----------------

async function snapshot(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    for (const inv of invites.values()) {
      map.set(inv.code, {
        uses: inv.uses ?? 0,
        maxUses: inv.maxUses ?? 0,
        inviterId: inv.inviter?.id ?? null,
      });
    }
    return map;
  } catch (err) {
    console.error(`[invites] Couldn't read invites for ${guild.name} (needs Manage Server):`, err.message);
    return null;
  }
}

async function primeGuild(guild) {
  const snap = await snapshot(guild);
  if (snap) cache.set(guild.id, snap);
}

// Figures out which invite the newest member used, and refreshes the cache.
async function resolveInviter(guild) {
  const after = await snapshot(guild);
  if (!after) return null;

  const before = cache.get(guild.id);
  cache.set(guild.id, after);
  // No earlier snapshot to compare against — can't attribute this join.
  if (!before) return null;

  // 1. An invite whose use-count went up.
  for (const [code, inv] of after) {
    const prev = before.get(code);
    if (inv.uses > (prev ? prev.uses : 0)) return { code, inviterId: inv.inviterId };
  }

  // 2. A limited invite that vanished: its last use deletes it.
  for (const [code, prev] of before) {
    if (!after.has(code) && prev.maxUses > 0 && prev.uses + 1 >= prev.maxUses) {
      return { code, inviterId: prev.inviterId };
    }
  }

  return null;
}

// ---------------- announcing ----------------

async function announce(guild, content) {
  const channelId = process.env.INVITE_LOG_CHANNEL_ID;
  let channel = null;
  if (channelId) channel = await guild.channels.fetch(channelId).catch(() => null);
  channel = channel || guild.systemChannel;

  if (!channel?.isTextBased()) {
    console.warn("[invites] No channel to post in — set INVITE_LOG_CHANNEL_ID in your env.");
    return;
  }

  // allowedMentions: names show as mentions but nobody gets pinged.
  await channel
    .send({ content, allowedMentions: { parse: [] } })
    .catch((err) => console.error("[invites] Couldn't post message:", err.message));
}

async function handleMemberAdd(member) {
  const { guild } = member;
  const found = await resolveInviter(guild); // always runs, so the cache stays current

  if (member.user.bot) return;

  if (!found || !found.inviterId) {
    markReturned(guild.id, member.id);
    await announce(guild, `<@${member.id}> joined, but I couldn't tell who invited them.`);
    return;
  }

  const total = recordInvite(guild.id, found.inviterId, member.id);
  await announce(
    guild,
    `<@${found.inviterId}> invited <@${member.id}> and has ${total} invite${total === 1 ? "" : "s"}`
  );
}

function handleMemberRemove(member) {
  if (member.user?.bot) return;
  recordLeave(member.guild.id, member.id);
}

// ---------------- the "-i" command ----------------

// "-i" or "-i <@mention or user id>" — nothing else, so words like
// "-info" never trigger it. The target is read from the text itself
// (not message.mentions) so replying to someone doesn't pick them.
const COMMAND_RE = /^-i(?:\s+(\S+))?\s*$/i;

async function handleCommand(message) {
  if (message.author.bot || !message.guild) return;

  const match = COMMAND_RE.exec(message.content.trim());
  if (!match) return;

  let user = message.author;
  if (match[1]) {
    const id = match[1].replace(/[<@!>]/g, "");
    user = /^\d{15,22}$/.test(id) ? await message.client.users.fetch(id).catch(() => null) : null;
    if (!user) {
      await message
        .reply({ content: "I couldn't find that user. Use `-i` or `-i @user`.", allowedMentions: { repliedUser: false } })
        .catch(() => {});
      return;
    }
  }

  // Server avatar if they have one, otherwise their normal profile picture.
  const member = await message.guild.members.fetch(user.id).catch(() => null);
  const avatar = (member ?? user).displayAvatarURL({ size: 256 });
  const stats = getStats(message.guild.id, user.id);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setAuthor({ name: `@${user.username}` })
    .setThumbnail(avatar)
    .addFields(
      { name: "Joins", value: String(stats.joins), inline: true },
      { name: "Left", value: String(stats.left), inline: true }
    )
    .setFooter({ text: FOOTER_TEXT });

  await message
    .reply({ embeds: [embed], allowedMentions: { repliedUser: false } })
    .catch((err) => console.error("[invites] Couldn't send -i card:", err.message));
}

// ---------------- wiring ----------------

function enqueue(guildId, task) {
  const next = (queues.get(guildId) || Promise.resolve())
    .then(task)
    .catch((err) => console.error("[invites] Error handling a join/leave:", err));
  queues.set(guildId, next);
  return next;
}

function setupInviteTracker(client) {
  client.once("ready", async () => {
    for (const guild of client.guilds.cache.values()) await primeGuild(guild);
    console.log("🔗 Invite tracker ready.");
  });

  client.on("guildCreate", (guild) => primeGuild(guild));

  client.on("inviteCreate", (invite) => {
    if (!invite.guild) return;
    const snap = cache.get(invite.guild.id);
    if (snap) {
      snap.set(invite.code, {
        uses: invite.uses ?? 0,
        maxUses: invite.maxUses ?? 0,
        inviterId: invite.inviter?.id ?? null,
      });
    }
  });

  // inviteDelete is deliberately NOT handled: when a limited invite is
  // used up Discord deletes it, and we need its old entry kept to spot that.

  client.on("guildMemberAdd", (member) => {
    enqueue(member.guild.id, () => handleMemberAdd(member));
  });

  client.on("guildMemberRemove", (member) => {
    enqueue(member.guild.id, () => handleMemberRemove(member));
  });

  client.on("messageCreate", (message) => {
    handleCommand(message).catch((err) => console.error("[invites] -i command error:", err));
  });
}

module.exports = { setupInviteTracker };
