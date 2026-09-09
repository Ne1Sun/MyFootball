import assert from "node:assert/strict";
import test from "node:test";
import { shootoutIsDecided, maxMinuteForPeriod } from "../app/lib/competition.ts";
import { signSession, verifySession } from "../app/lib/auth-crypto.ts";

test("shootoutIsDecided correctly declares regulation 5-kick victories", () => {
  // 5 kicks each, score 5 - 4 -> must be decided
  assert.equal(shootoutIsDecided(5, 4, 5, 5), true, "5-4 after 5 kicks must be decided");

  // 5 kicks each, score 4 - 3 -> must be decided
  assert.equal(shootoutIsDecided(4, 3, 5, 5), true, "4-3 after 5 kicks must be decided");

  // 5 kicks each, score 3 - 3 -> tied, must NOT be decided
  assert.equal(shootoutIsDecided(3, 3, 5, 5), false, "3-3 after 5 kicks must not be decided");

  // Early victory: 3 - 0 after 3 kicks each (remaining kicks = 2, unassailable)
  assert.equal(shootoutIsDecided(3, 0, 3, 3), true, "3-0 after 3 kicks must be decided");

  // Sudden death: 6 kicks each, score 6 - 5 -> must be decided
  assert.equal(shootoutIsDecided(6, 5, 6, 6), true, "6-5 in sudden death must be decided");

  // Sudden death: 6 kicks each, score 5 - 5 -> must NOT be decided
  assert.equal(shootoutIsDecided(5, 5, 6, 6), false, "5-5 in sudden death must not be decided");
});

test("maxMinuteForPeriod allows legitimate stoppage time buffers", () => {
  const halfMinutes = 45;
  // First half: nominal 45, max with 15-min stoppage buffer = 60
  const firstHalfMax = maxMinuteForPeriod("first_half", halfMinutes);
  assert.ok(firstHalfMax >= 55, `First half max (${firstHalfMax}) should permit 45+7'`);
  assert.ok(48 <= firstHalfMax, "Minute 48 (45+3') must be within first half max");

  // Second half: nominal 90, max with 15-min stoppage buffer = 105
  const secondHalfMax = maxMinuteForPeriod("second_half", halfMinutes);
  assert.ok(secondHalfMax >= 100, `Second half max (${secondHalfMax}) should permit 90+7'`);
  assert.ok(96 <= secondHalfMax, "Minute 96 (90+6') must be within second half max");
});

test("cryptographic session tokens sign, verify and reject tampered payloads", async () => {
  const payload = {
    email: "organizer@bharatfootball.in",
    displayName: "Head Organizer",
    role: "organizer",
    iat: Date.now(),
  };

  const token = await signSession(payload);
  assert.ok(typeof token === "string" && token.includes("."), "Token must be in data.signature format");

  // Valid token verification
  const verified = await verifySession(token);
  assert.equal(verified?.email, payload.email);
  assert.equal(verified?.displayName, payload.displayName);

  // Tampered payload verification
  const [dataHex, sigHex] = token.split(".");
  const tamperedDataHex = dataHex.slice(0, -4) + "ffff";
  const tamperedToken = `${tamperedDataHex}.${sigHex}`;
  const tamperedResult = await verifySession(tamperedToken);
  assert.equal(tamperedResult, null, "Tampered token must be rejected");
});
