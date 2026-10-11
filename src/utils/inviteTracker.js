// ============================================================
// DIFUSED TIERS — invite tracker.
// Posts "@inviter invited @member and has N invites" whenever someone
// joins the server through an invite link.
//
// How it works: Discord doesn't say which invite a new member used, so
// we keep a snapshot of every invite's use-count and, when a member
// joins, see which invite's count went up.
//
// Needs: GuildInvites + GuildMembers intents, and the bot's "Manage
// Server" permission (to read the invite list). Optional env var
// INVITE_LOG_CHANNEL_ID picks the channel; otherwise the server's
// system channel is used.
// ============================================================

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const INVITES_FILE = path.join(DATA_DIR, "invites.json");

// guildId -> Map(code -> { uses, maxUses, inviterId })
const cache = new Map();
// guildId -> promise chain, so simultaneous joins are processed one at a
// time (otherwise two joins can both "see" the same invite jump).
const queues = new Map();

// ---------------- storage: { guildId: { inviterId: { invited: [ids] } } } ----------------

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

// Counts each invited member once, so someone leaving and rejoining
// through the same inviter doesn't inflate their number.
function recordInvite(guildId, inviterId, inviteeId) {
  const data = load();
  const guildData = (data[guildId] ??= {});
  const entry = (guildData[inviterId] ??= { invited: [] });
  if (!entry.invited.includes(inviteeId)) entry.invited.push(inviteeId);
  save(data);
  return entry.invited.length;
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
    await announce(guild, `<@${member.id}> joined, but I couldn't tell who invited them.`);
    return;
  }

  const total = recordInvite(guild.id, found.inviterId, member.id);
  await announce(
    guild,
    `<@${found.inviterId}> invited <@${member.id}> and has ${total} invite${total === 1 ? "" : "s"}`
  );
}

function enqueue(guildId, task) {
  const next = (queues.get(guildId) || Promise.resolve())
    .then(task)
    .catch((err) => console.error("[invites] Error handling a join:", err));
  queues.set(guildId, next);
  return next;
}

// ---------------- wiring ----------------

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
}

module.exports = { setupInviteTracker };
