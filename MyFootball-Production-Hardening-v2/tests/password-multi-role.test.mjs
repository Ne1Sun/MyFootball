import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, signSession, verifySession } from "../app/lib/auth-crypto.ts";

test("PBKDF2 Password Hashing & Verification: Correct Password", async () => {
  const plainPassword = "Grassroots@2026";
  const serializedHash = await hashPassword(plainPassword);

  assert.ok(serializedHash.startsWith("pbkdf2$100000$"), "Hash must have pbkdf2$100000$ header");
  const parts = serializedHash.split("$");
  assert.equal(parts.length, 4, "Hash must have format pbkdf2$iterations$salt$hash");
  assert.equal(parts[1], "100000", "Iterations must be 100000");
  assert.equal(parts[2].length, 32, "Salt must be 16 bytes (32 hex characters)");
  assert.equal(parts[3].length, 64, "Key must be 32 bytes / 256 bits (64 hex characters)");

  const isValid = await verifyPassword(plainPassword, serializedHash);
  assert.equal(isValid, true, "Verification with correct password must return true");
});

test("PBKDF2 Password Hashing & Verification: Wrong Password Rejection", async () => {
  const plainPassword = "Grassroots@2026";
  const serializedHash = await hashPassword(plainPassword);

  const isValidWrong = await verifyPassword("WrongPassword123!", serializedHash);
  assert.equal(isValidWrong, false, "Verification with wrong password must return false");

  const isValidEmpty = await verifyPassword("", serializedHash);
  assert.equal(isValidEmpty, false, "Verification with empty password must return false");
});

test("PBKDF2 Password Verification: Tampered & Corrupted Hash Resilience", async () => {
  assert.equal(await verifyPassword("password", ""), false, "Empty hash must return false");
  assert.equal(await verifyPassword("password", "invalid-format"), false, "Invalid format must return false");
  assert.equal(await verifyPassword("password", "pbkdf2$100000$deadbeef$short"), false, "Wrong length must return false");
  assert.equal(await verifyPassword("password", "pbkdf2$invalid$salt$hash"), false, "Non-numeric iterations must return false");
});

test("Multi-Role Session Stamping: Single Identity Across Roles Without Collisions", async () => {
  const email = "coach@myfootball.in";
  const name = "Coach Subrata Paul";

  // Login as Coach
  const coachSessionToken = await signSession({
    email,
    fullName: name,
    displayName: name,
    role: "coach",
    iat: Date.now(),
  });
  const verifiedCoach = await verifySession(coachSessionToken);
  assert.ok(verifiedCoach);
  assert.equal(verifiedCoach.email, email);
  assert.equal(verifiedCoach.role, "coach");

  // Login as Fan with the same account email
  const fanSessionToken = await signSession({
    email,
    fullName: name,
    displayName: name,
    role: "fan",
    iat: Date.now(),
  });
  const verifiedFan = await verifySession(fanSessionToken);
  assert.ok(verifiedFan);
  assert.equal(verifiedFan.email, email);
  assert.equal(verifiedFan.role, "fan");

  // Login as Referee with the same account email
  const refSessionToken = await signSession({
    email,
    fullName: name,
    displayName: name,
    role: "referee",
    iat: Date.now(),
  });
  const verifiedRef = await verifySession(refSessionToken);
  assert.ok(verifiedRef);
  assert.equal(verifiedRef.email, email);
  assert.equal(verifiedRef.role, "referee");
});

test("Coach-Only Tournament Enrollment: RBAC Authorization Simulation", () => {
  const checkEnrollmentPermission = (user) => {
    if (!user) return { status: 401, error: "Sign in to register a team." };
    if (user.role !== "coach") {
      return {
        status: 403,
        error: "Only registered Academy Coaches and Team Managers can enroll squads into tournaments. Please sign out and log in with a Coach account.",
        code: "COACH_ROLE_REQUIRED",
      };
    }
    return { status: 200, ok: true };
  };

  // Test guest
  assert.equal(checkEnrollmentPermission(null).status, 401);

  // Test fan role
  const fanResult = checkEnrollmentPermission({ email: "user@gmail.com", role: "fan" });
  assert.equal(fanResult.status, 403);
  assert.equal(fanResult.code, "COACH_ROLE_REQUIRED");

  // Test referee role
  const refResult = checkEnrollmentPermission({ email: "ref@myfootball.in", role: "referee" });
  assert.equal(refResult.status, 403);
  assert.equal(refResult.code, "COACH_ROLE_REQUIRED");

  // Test organizer role
  const orgResult = checkEnrollmentPermission({ email: "org@myfootball.in", role: "organizer" });
  assert.equal(orgResult.status, 403);
  assert.equal(orgResult.code, "COACH_ROLE_REQUIRED");

  // Test coach role
  const coachResult = checkEnrollmentPermission({ email: "coach@myfootball.in", role: "coach" });
  assert.equal(coachResult.status, 200);
  assert.equal(coachResult.ok, true);
});
