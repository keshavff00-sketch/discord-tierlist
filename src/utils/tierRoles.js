const ALL_TIERS = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"];

function tokens(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
}

function findTierRole(guild, gamemodeKey, gamemodeName, tier) {
  const envKey = `${String(gamemodeKey).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${tier}_ROLE_ID`;
  const envId = process.env[envKey];
  if (envId) {
    const byId = guild.roles.cache.get(envId);
    if (byId) return byId;
  }

  const tierToken = tier.toLowerCase();
  const gmTokens = tokens(gamemodeName);
  return (
    guild.roles.cache.find((r) => {
      const t = tokens(r.name);
      return t.includes(tierToken) && gmTokens.every((g) => t.includes(g));
    }) || null
  );
}

async function assignTierRole(guild, userId, gamemodeKey, gamemodeName, tier) {
  try {
    await guild.roles.fetch();
    const member = await guild.members.fetch(userId);

    const newRole = findTierRole(guild, gamemodeKey, gamemodeName, tier);
    if (!newRole) return `\n⚠️ \`${gamemodeName} ${tier}\` role nahi mila, role nahi diya.`;

    const oldRoles = ALL_TIERS
      .map((t) => findTierRole(guild, gamemodeKey, gamemodeName, t))
      .filter((r) => r && r.id !== newRole.id && member.roles.cache.has(r.id));

    if (oldRoles.length) await member.roles.remove(oldRoles);
    await member.roles.add(newRole);
    return `\n🎖️ **${newRole.name}** role de diya.`;
  } catch (err) {
    console.error("Role assign failed:", err);
    return "\n⚠️ Role nahi de paya. Bot ka role tier roles ke upar hona chahiye + Manage Roles permission.";
  }
}

module.exports = { assignTierRole };
