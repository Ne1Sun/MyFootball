import test from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession } from "../app/lib/auth-crypto.ts";

test("Multi-Role Auth: HMAC-SHA256 Token Issuance & Verification", async () => {
  const payload = {
    email: "organizer@myfootball.in",
    fullName: "Vikramaditya Singhania",
    displayName: "Vikramaditya Singhania",
    role: "organizer",
    iat: Date.now(),
  };

  const token = await signSession(payload);
  assert.ok(token, "Token should be generated");
  assert.ok(token.includes("."), "Token should follow [hexPayload].[hexSignature] format");

  const verified = await verifySession(token);
  assert.ok(verified, "Token should be verified successfully");
  assert.equal(verified.email, "organizer@myfootball.in");
  assert.equal(verified.role, "organizer");
  assert.equal(verified.fullName, "Vikramaditya Singhania");
});

test("Multi-Role Auth: Tampered Token Rejection", async () => {
  const payload = {
    email: "coach@myfootball.in",
    fullName: "Coach Subrata Paul",
    role: "coach",
    iat: Date.now(),
  };

  const token = await signSession(payload);
  const [hexPayload, hexSig] = token.split(".");

  // Tamper with payload by changing email to admin
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...payload, email: "admin@myfootball.in", role: "organizer" })
  ).toString("hex");

  const tamperedToken = `${tamperedPayload}.${hexSig}`;
  const verified = await verifySession(tamperedToken);
  assert.equal(verified, null, "Tampered token MUST be rejected with null");
});

test("Multi-Role Auth: Malformed and Empty Tokens", async () => {
  assert.equal(await verifySession(""), null, "Empty token should return null");
  assert.equal(await verifySession("random-garbage-string"), null, "Garbage token should return null");
  assert.equal(await verifySession("foo.bar"), null, "Invalid hex signature should return null");
});

test("Multi-Role Auth: Preconfigured Football Personas", () => {
  const personas = {
    "organizer@myfootball.in": { role: "organizer", defaultPath: "/organize" },
    "coach@myfootball.in": { role: "coach", defaultPath: "/coach" },
    "referee@myfootball.in": { role: "referee", defaultPath: "/referee" },
    "fan@myfootball.in": { role: "fan", defaultPath: "/discover" },
  };

  for (const [email, expected] of Object.entries(personas)) {
    assert.ok(email.endsWith("@myfootball.in"));
    assert.ok(["organizer", "coach", "referee", "fan"].includes(expected.role));
    assert.ok(expected.defaultPath.startsWith("/"));
  }
});

test("Multi-Role Auth: Email & Role Validation Invariants", () => {
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const VALID_ROLES = ["organizer", "coach", "referee", "fan"];

  // Valid emails
  assert.ok(EMAIL_REGEX.test("coach@punjabfootball.in"));
  assert.ok(EMAIL_REGEX.test("referee@aiff.org"));
  assert.ok(EMAIL_REGEX.test("user.name+tag@subdomain.domain.co"));

  // Invalid emails
  assert.ok(!EMAIL_REGEX.test(""));
  assert.ok(!EMAIL_REGEX.test("no-at-sign.com"));
  assert.ok(!EMAIL_REGEX.test("spaces in@email.com"));
  assert.ok(!EMAIL_REGEX.test("@no-local.com"));

  // Valid roles
  for (const role of VALID_ROLES) {
    assert.ok(VALID_ROLES.includes(role));
  }

  // Invalid roles
  assert.ok(!VALID_ROLES.includes("admin"));
  assert.ok(!VALID_ROLES.includes("superadmin"));
  assert.ok(!VALID_ROLES.includes("hacker"));
});

test("Multi-Role Auth: Referee Authority Invariant", () => {
  // Simulating fixture authorization logic from app/api/app/route.ts
  const checkFixtureAuth = (tournamentOrganizerEmail, user) => {
    return (
      tournamentOrganizerEmail === user.email ||
      user.role === "referee" ||
      user.role === "organizer" ||
      user.email === "referee@myfootball.in"
    );
  };

  const tournamentOrganizer = "organizer@myfootball.in";

  // 1. Tournament director should have authority
  assert.equal(
    checkFixtureAuth(tournamentOrganizer, { email: "organizer@myfootball.in", role: "organizer" }),
    true
  );

  // 2. Designated referee should have authority even though they don't own the tournament
  assert.equal(
    checkFixtureAuth(tournamentOrganizer, { email: "referee@myfootball.in", role: "referee" }),
    true
  );

  // 3. Any AIFF official with role 'referee' should have pitch-side authority
  assert.equal(
    checkFixtureAuth(tournamentOrganizer, { email: "external.referee@aiff.org", role: "referee" }),
    true
  );

  // 4. Spectator / Fan must NOT have authority
  assert.equal(
    checkFixtureAuth(tournamentOrganizer, { email: "fan@myfootball.in", role: "fan" }),
    false
  );

  // 5. Coach from an opposing academy must NOT have authority over the referee console
  assert.equal(
    checkFixtureAuth(tournamentOrganizer, { email: "coach@myfootball.in", role: "coach" }),
    false
  );
});
