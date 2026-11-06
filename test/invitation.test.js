import test from "node:test";
import assert from "node:assert/strict";
import { buildInvitation, parseInvitation } from "../src/invitation.js";

const t = 1794000000000;
const good = () => buildInvitation({ deviceId: "light-node", capabilities: ["optical"], nonce: "unique-token-1234", nowMs: t });

test("valid short-lived invitation is explicitly unauthenticated", () => {
  const res = parseInvitation(good(), t + 2000);
  assert.equal(res.ok, true);
  assert.equal(res.authenticated, false);
  assert.equal(res.invitation.deviceId, "light-node");
});

test("expired and future-dated invitations fail", () => {
  assert.equal(parseInvitation(good(), t + 301000).ok, false);
  assert.equal(parseInvitation(good(), t - 70000).ok, false);
});

test("malformed, oversized, and hostile fields fail safely", () => {
  assert.equal(parseInvitation("{").ok, false);
  assert.equal(parseInvitation("x".repeat(3000)).ok, false);
  assert.equal(parseInvitation(good().replace("light-node", "<script>"), t).ok, false);
  assert.throws(() => buildInvitation({ deviceId: "../oops", nonce: "unique-token-1234" }));
});

test("QR payload supports multiple supported capabilities", () => {
  const payload = buildInvitation({
    deviceId: "powe-hub", capabilities: ["rf", "optical", "near-field"],
    nonce: "example-nonce-0001", nowMs: t, ttlSeconds: 60
  });
  assert.deepEqual(parseInvitation(payload, t + 1000).invitation.capabilities, ["rf", "optical", "near-field"]);
});
