// PoWE pairing invitation v1. A QR payload transports this JSON.
// Valid structure/expiry is NEVER cryptographic identity verification.
const PROTOCOL = "powe-invitation";
const ALLOWED_CAPABILITIES = new Set(["rf", "optical", "near-field"]);
const DEVICE = /^[a-zA-Z0-9_-]{1,64}$/;
const NONCE = /^[a-zA-Z0-9-]{8,128}$/;

export function buildInvitation({
  deviceId, capabilities = ["rf", "optical", "near-field"],
  nonce, nowMs = Date.now(), ttlSeconds = 300
}) {
  if (!DEVICE.test(deviceId || "")) throw new Error("Invalid device ID");
  if (!NONCE.test(nonce || "")) throw new Error("Invalid invitation nonce");
  if (!Array.isArray(capabilities) || capabilities.length === 0 ||
      capabilities.length > 3 || capabilities.some(c => !ALLOWED_CAPABILITIES.has(c)) ||
      new Set(capabilities).size !== capabilities.length) {
    throw new Error("Invalid capabilities");
  }
  if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 3600) {
    throw new Error("Invalid invitation lifetime");
  }
  return JSON.stringify({
    protocol: PROTOCOL, version: 1, deviceId, capabilities,
    nonce, issuedAtMs: nowMs, expiresAtMs: nowMs + ttlSeconds * 1000
  });
}

export function parseInvitation(text, nowMs = Date.now()) {
  if (typeof text !== "string" || text.length > 2048 || !text.trim()) {
    return { ok: false, reason: "Empty or oversized invitation" };
  }
  try {
    const item = JSON.parse(text);
    if (!item || Array.isArray(item) || typeof item !== "object" ||
        item.protocol !== PROTOCOL || item.version !== 1 ||
        !DEVICE.test(item.deviceId || "") || !NONCE.test(item.nonce || "")) {
      return { ok: false, reason: "Unrecognized or malformed invitation" };
    }
    if (!Array.isArray(item.capabilities) || item.capabilities.length < 1 ||
        item.capabilities.length > 3 ||
        item.capabilities.some(c => !ALLOWED_CAPABILITIES.has(c)) ||
        new Set(item.capabilities).size !== item.capabilities.length) {
      return { ok: false, reason: "Invalid capabilities" };
    }
    if (!Number.isSafeInteger(nowMs) || !Number.isSafeInteger(item.issuedAtMs) ||
        !Number.isSafeInteger(item.expiresAtMs) ||
        item.expiresAtMs - item.issuedAtMs < 30000 ||
        item.expiresAtMs - item.issuedAtMs > 3600000 ||
        item.issuedAtMs > nowMs + 60000 ||
        item.expiresAtMs <= nowMs) {
      return { ok: false, reason: "Invitation is expired or has invalid timestamps" };
    }
    return { ok: true, invitation: item, authenticated: false };
  } catch {
    return { ok: false, reason: "Invitation is not valid JSON" };
  }
}
