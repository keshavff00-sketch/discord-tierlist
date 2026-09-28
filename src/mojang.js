// ============================================================
// DIFUSED TIERS — Mojang lookup helpers.
// Resolves a Minecraft username to a UUID and gives back a
// rendered head/avatar image URL (via the public Crafatar service)
// for use in profile embeds.
//
// Premium (paid) accounts are resolved via the official Mojang API.
// Cracked (offline-mode) accounts don't exist on Mojang's servers, so
// for those we fall back to generating the same offline UUID a
// cracked Minecraft server would generate locally (a version-3 UUID
// derived from "OfflinePlayer:<username>"). This lets cracked players
// register too — their profile just won't have a real skin on
// Crafatar (it'll show the default Steve/Alex render), since that
// requires a real Mojang account.
// ============================================================

const crypto = require("crypto");
const { ALLOW_CRACKED_ACCOUNTS } = require("../config");

// Minecraft usernames: 3-16 chars, letters/digits/underscore only.
const VALID_USERNAME = /^[A-Za-z0-9_]{3,16}$/;

function offlineUUID(username) {
  const hash = crypto.createHash("md5").update(`OfflinePlayer:${username}`, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // version 3
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function lookupUUID(username) {
  if (!VALID_USERNAME.test(username)) return { error: "invalid_format" };

  try {
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(
        username
      )}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        return { uuid: data.id, ign: data.name, cracked: false };
      }
    } else if (res.status !== 404) {
      // Mojang API error/rate-limit (not a "no such account" response) —
      // don't silently treat this as a cracked account.
      return { error: "lookup_failed" };
    }
  } catch (err) {
    return { error: "lookup_failed" };
  }

  // Not a premium account (404 from Mojang).
  if (!ALLOW_CRACKED_ACCOUNTS) return { error: "not_premium" };

  return { uuid: offlineUUID(username), ign: username, cracked: true };
}

function headUrl(uuid) {
  if (!uuid) return null;
  return `https://crafatar.com/avatars/${uuid}?size=128&overlay`;
}

function bodyUrl(uuid) {
  if (!uuid) return null;
  return `https://crafatar.com/renders/body/${uuid}?scale=8&overlay`;
}

module.exports = { lookupUUID, headUrl, bodyUrl };
