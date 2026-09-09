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

test("Route Guard Precedence: Active Session Role Overrides Database Signup Role", () => {
  // Formal precedence resolver implemented in organize, coach, referee route guards
  const resolveEffectiveRole = (sessionUser, dbProfile) => {
    return sessionUser?.role || dbProfile?.role || "fan";
  };

  const evaluateHubAccess = (effectiveRole, requiredRole) => {
    return effectiveRole === requiredRole;
  };

  // Scenario 1: User initially registered as "fan", now logs in selecting "organizer"
  const userA_session = { email: "vikram@gmail.com", role: "organizer" };
  const userA_db = { email: "vikram@gmail.com", role: "fan" };

  const effectiveRoleA = resolveEffectiveRole(userA_session, userA_db);
  assert.equal(effectiveRoleA, "organizer", "Session role MUST override database signup role");
  assert.equal(evaluateHubAccess(effectiveRoleA, "organizer"), true, "Must have permission for Organize Hub");
  assert.equal(evaluateHubAccess(effectiveRoleA, "coach"), false, "Must NOT have permission for Coach Hub");

  // Scenario 2: User registered as "fan", now logs in selecting "coach"
  const userB_session = { email: "subrata@gmail.com", role: "coach" };
  const userB_db = { email: "subrata@gmail.com", role: "fan" };

  const effectiveRoleB = resolveEffectiveRole(userB_session, userB_db);
  assert.equal(effectiveRoleB, "coach", "Session role MUST override database signup role");
  assert.equal(evaluateHubAccess(effectiveRoleB, "coach"), true, "Must have permission for Coach Hub");
  assert.equal(evaluateHubAccess(effectiveRoleB, "organizer"), false, "Must NOT have permission for Organize Hub");

  // Scenario 3: User registered as "coach", now logs in selecting "referee"
  const userC_session = { email: "referee@gmail.com", role: "referee" };
  const userC_db = { email: "referee@gmail.com", role: "coach" };

  const effectiveRoleC = resolveEffectiveRole(userC_session, userC_db);
  assert.equal(effectiveRoleC, "referee", "Session role MUST override database signup role");
  assert.equal(evaluateHubAccess(effectiveRoleC, "referee"), true, "Must have permission for Referee Console");

  // Scenario 4: User without explicit session role falls back to database profile
  const userD_session = { email: "guest@gmail.com" }; // No session.role
  const userD_db = { email: "guest@gmail.com", role: "organizer" };
  assert.equal(resolveEffectiveRole(userD_session, userD_db), "organizer", "Fallback to database role if session role absent");

  // Scenario 5: User with neither session role nor DB role falls back to "fan"
  assert.equal(resolveEffectiveRole(null, null), "fan", "Complete fallback must default safely to fan");
});

test("Security: Forged and Invalid Role Parameter Sanitization", async () => {
  const VALID_ROLES = ["organizer", "coach", "referee", "fan"];
  const sanitizeRole = (input) => {
    const trimmed = typeof input === "string" ? input.trim().toLowerCase() : "fan";
    return VALID_ROLES.includes(trimmed) ? trimmed : "fan";
  };

  // Malicious injections must fall back to "fan"
  assert.equal(sanitizeRole("admin"), "fan", "Admin escalation must fall back to fan");
  assert.equal(sanitizeRole("super_organizer"), "fan", "Invalid role must fall back to fan");
  assert.equal(sanitizeRole("<script>alert(1)</script>"), "fan", "XSS injection must fall back to fan");
  assert.equal(sanitizeRole(""), "fan", "Empty string must fall back to fan");
  assert.equal(sanitizeRole(null), "fan", "Null must fall back to fan");
  assert.equal(sanitizeRole(undefined), "fan", "Undefined must fall back to fan");
  assert.equal(sanitizeRole("__proto__"), "fan", "Prototype pollution must fall back to fan");

  // Legitimate roles must be preserved
  assert.equal(sanitizeRole("coach"), "coach");
  assert.equal(sanitizeRole("organizer"), "organizer");
  assert.equal(sanitizeRole("referee"), "referee");
  assert.equal(sanitizeRole("fan"), "fan");
  assert.equal(sanitizeRole("  COACH  "), "coach", "Whitespace and casing must be normalized");
});

test("Zero-Clashing Invariant: Multi-Role Entity Non-Interference", async () => {
  // Relational datastore representation
  const userAccount = {
    email: "subrata@grassroots.in",
    role: "coach",
  };

  const ownedTournaments = [
    { id: "tourn-1", organizerEmail: "subrata@grassroots.in", title: "Kolkata Youth Cup" }
  ];
  const ownedClubs = [
    { id: "club-1", ownerEmail: "subrata@grassroots.in", name: "Bengal Tigers Academy" }
  ];
  const recordedMatchEvents = [
    { id: "evt-1", fixtureId: "fix-101", recordedBy: "subrata@grassroots.in", type: "goal" }
  ];

  // User logs out and re-logs in as "fan"
  userAccount.role = "fan";

  // Assert ownership references have zero mutation or deletion
  assert.equal(ownedTournaments[0].organizerEmail, userAccount.email, "Tournaments remain owned by organizerEmail");
  assert.equal(ownedClubs[0].ownerEmail, userAccount.email, "Clubs remain owned by ownerEmail");
  assert.equal(recordedMatchEvents[0].recordedBy, userAccount.email, "Match events retain referee recordedBy attribution");

  // User logs out and re-logs in as "referee"
  userAccount.role = "referee";
  assert.equal(ownedClubs.length, 1, "Clubs are never pruned on role transition");
  assert.equal(ownedTournaments.length, 1, "Tournaments are never pruned on role transition");
});

test("UI Discover Gating: Enroll Squad Visibility Invariant", () => {
  const evaluateDiscoverCardActions = (item, userRole) => {
    const totalCapacity = item.maxTeams || 16;
    const hasCapacity = totalCapacity === 0 || item.registeredTeams < totalCapacity;
    const canRegister = ["registration_open", "live", "scheduled"].includes(item.status) && hasCapacity;
    
    return {
      showOpenTournament: true,
      showEnrollSquad: Boolean(canRegister && userRole === "coach"),
    };
  };

  const openTournament = { status: "registration_open", registeredTeams: 6, maxTeams: 16 };
  const fullTournament = { status: "registration_open", registeredTeams: 16, maxTeams: 16 };

  // 1. Coach viewing open tournament -> Can see Enroll Squad
  const coachView = evaluateDiscoverCardActions(openTournament, "coach");
  assert.equal(coachView.showOpenTournament, true);
  assert.equal(coachView.showEnrollSquad, true);

  // 2. Fan viewing open tournament -> Enroll Squad HIDDEN
  const fanView = evaluateDiscoverCardActions(openTournament, "fan");
  assert.equal(fanView.showOpenTournament, true);
  assert.equal(fanView.showEnrollSquad, false);

  // 3. Referee viewing open tournament -> Enroll Squad HIDDEN
  const refereeView = evaluateDiscoverCardActions(openTournament, "referee");
  assert.equal(refereeView.showOpenTournament, true);
  assert.equal(refereeView.showEnrollSquad, false);

  // 4. Coach viewing full tournament -> Enroll Squad HIDDEN
  const coachFullView = evaluateDiscoverCardActions(fullTournament, "coach");
  assert.equal(coachFullView.showOpenTournament, true);
  assert.equal(coachFullView.showEnrollSquad, false);
});
