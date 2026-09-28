// ============================================================
// DIFUSED TIERS — Skin rendering for embeds.
// Fetches and attaches Minecraft skin images (premium or default Steve).
// ============================================================

/**
 * Fetches skin image buffer for embed attachment.
 * @param {string} uuid - Player UUID
 * @param {boolean} cracked - If true, renders default Steve skin
 * @returns {Promise<Buffer|null>} PNG image buffer or null if failed
 */
async function getSkinImage(uuid, cracked = false) {
  const skinUuid = cracked ? "8667ba71b85a4004af54457a9734eed7" : uuid;
  if (!skinUuid) return null;

  try {
    const res = await fetch(`https://crafatar.com/skins/${skinUuid}`);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn("Failed to fetch skin:", err.message);
    return null;
  }
}

module.exports = { getSkinImage };

