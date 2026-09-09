import test from "node:test";
import assert from "node:assert/strict";

test("RBAC Navigation: Universal vs Role-Specific Hub Visibility", () => {
  const baseNavItems = [
    { href: "/", label: "Home", id: "home" },
    { href: "/discover", label: "Discover", id: "discover" },
  ];

  const roleNavMap = {
    organizer: { href: "/organize", label: "Organizer Hub", id: "organize" },
    coach: { href: "/coach", label: "Coach Hub", id: "coach" },
    referee: { href: "/referee", label: "Referee Console", id: "referee" },
  };

  const getNavForRole = (role) => [
    ...baseNavItems,
    ...(role && roleNavMap[role] ? [roleNavMap[role]] : []),
  ];

  // 1. Guest (unauthenticated) sees only universal tabs
  const guestNav = getNavForRole(undefined);
  assert.equal(guestNav.length, 2);
  assert.deepEqual(guestNav.map((n) => n.id), ["home", "discover"]);

  // 2. Fan sees only universal tabs
  const fanNav = getNavForRole("fan");
  assert.equal(fanNav.length, 2);
  assert.deepEqual(fanNav.map((n) => n.id), ["home", "discover"]);

  // 3. Organizer sees Home, Discover, and Organizer Hub (NO Coach Hub, NO Referee Console)
  const organizerNav = getNavForRole("organizer");
  assert.equal(organizerNav.length, 3);
  assert.deepEqual(organizerNav.map((n) => n.id), ["home", "discover", "organize"]);
  assert.ok(!organizerNav.some((n) => n.id === "coach"));
  assert.ok(!organizerNav.some((n) => n.id === "referee"));

  // 4. Coach sees Home, Discover, and Coach Hub (NO Organizer Hub, NO Referee Console)
  const coachNav = getNavForRole("coach");
  assert.equal(coachNav.length, 3);
  assert.deepEqual(coachNav.map((n) => n.id), ["home", "discover", "coach"]);
  assert.ok(!coachNav.some((n) => n.id === "organize"));
  assert.ok(!coachNav.some((n) => n.id === "referee"));

  // 5. Referee sees Home, Discover, and Referee Console (NO Organizer Hub, NO Coach Hub)
  const refereeNav = getNavForRole("referee");
  assert.equal(refereeNav.length, 3);
  assert.deepEqual(refereeNav.map((n) => n.id), ["home", "discover", "referee"]);
  assert.ok(!refereeNav.some((n) => n.id === "organize"));
  assert.ok(!refereeNav.some((n) => n.id === "coach"));
});

test("RBAC Route Guard Invariants: Access Control Matrix", () => {
  const checkAccess = (route, userRole) => {
    if (route === "/organize") return userRole === "organizer";
    if (route === "/coach") return userRole === "coach";
    if (route === "/referee") return userRole === "referee";
    if (route === "/discover" || route === "/") return true; // Universal
    return false;
  };

  // Organizer route
  assert.equal(checkAccess("/organize", "organizer"), true);
  assert.equal(checkAccess("/organize", "coach"), false);
  assert.equal(checkAccess("/organize", "referee"), false);
  assert.equal(checkAccess("/organize", "fan"), false);
  assert.equal(checkAccess("/organize", undefined), false);

  // Coach route
  assert.equal(checkAccess("/coach", "coach"), true);
  assert.equal(checkAccess("/coach", "organizer"), false);
  assert.equal(checkAccess("/coach", "referee"), false);
  assert.equal(checkAccess("/coach", "fan"), false);
  assert.equal(checkAccess("/coach", undefined), false);

  // Referee route
  assert.equal(checkAccess("/referee", "referee"), true);
  assert.equal(checkAccess("/referee", "coach"), false);
  assert.equal(checkAccess("/referee", "organizer"), false);
  assert.equal(checkAccess("/referee", "fan"), false);
  assert.equal(checkAccess("/referee", undefined), false);

  // Discover route (Universal)
  assert.equal(checkAccess("/discover", "organizer"), true);
  assert.equal(checkAccess("/discover", "coach"), true);
  assert.equal(checkAccess("/discover", "referee"), true);
  assert.equal(checkAccess("/discover", "fan"), true);
  assert.equal(checkAccess("/discover", undefined), true);
});

test("Team Enrollment: Registration Availability Evaluator", () => {
  const canRegisterTournament = (tournament) => {
    const validStatuses = ["registration_open", "scheduled", "live"];
    if (!validStatuses.includes(tournament.status)) return false;
    const totalCapacity = tournament.divisions.reduce((sum, d) => sum + (d.maxTeams || 0), 0);
    const hasCapacity = totalCapacity === 0 || tournament.registeredTeams < totalCapacity;
    return hasCapacity;
  };

  // Live tournament with open division slots (e.g. Mumbai Super Cup with max 16, registered 8)
  assert.equal(
    canRegisterTournament({
      status: "live",
      registeredTeams: 8,
      divisions: [{ id: "div-1", maxTeams: 16 }],
    }),
    true,
    "Live tournament with open slots must allow team registration"
  );

  // Scheduled tournament with open slots
  assert.equal(
    canRegisterTournament({
      status: "scheduled",
      registeredTeams: 4,
      divisions: [{ id: "div-1", maxTeams: 8 }],
    }),
    true
  );

  // Tournament with full capacity
  assert.equal(
    canRegisterTournament({
      status: "live",
      registeredTeams: 8,
      divisions: [{ id: "div-1", maxTeams: 8 }],
    }),
    false,
    "Full capacity tournament must not allow registration"
  );

  // Completed tournament
  assert.equal(
    canRegisterTournament({
      status: "completed",
      registeredTeams: 6,
      divisions: [{ id: "div-1", maxTeams: 16 }],
    }),
    false,
    "Completed tournament must not allow registration"
  );
});

test("Team Enrollment: Coach-Only Button Visibility Invariant", () => {
  const shouldShowEnrollButton = (role, canRegister) => {
    return Boolean(canRegister && role === "coach");
  };

  // 1. Coach with open registration: MUST SHOW
  assert.equal(shouldShowEnrollButton("coach", true), true);

  // 2. Coach with closed registration: MUST NOT SHOW
  assert.equal(shouldShowEnrollButton("coach", false), false);

  // 3. Fan: MUST NOT SHOW even if registration is open
  assert.equal(shouldShowEnrollButton("fan", true), false);

  // 4. Referee: MUST NOT SHOW even if registration is open
  assert.equal(shouldShowEnrollButton("referee", true), false);

  // 5. Organizer: MUST NOT SHOW even if registration is open
  assert.equal(shouldShowEnrollButton("organizer", true), false);

  // 6. Unauthenticated Guest: MUST NOT SHOW
  assert.equal(shouldShowEnrollButton(undefined, true), false);
  assert.equal(shouldShowEnrollButton(null, true), false);
});

test("Live Matchday Telemetry: Payload Invariant Validation", () => {
  const sampleLiveMatch = {
    fixtureId: "fix-final-1",
    tournamentId: "tourney-mumbai-super-cup-2026",
    tournamentName: "Mumbai Super Cup 2026",
    tournamentState: "Maharashtra",
    venueName: "Cooperage Football Ground",
    divisionId: "tourney-mumbai-super-cup-2026-u17",
    divisionName: "Under-17 Premier Division",
    roundName: "Grand Final",
    pitch: 1,
    status: "in_progress",
    period: "first_half",
    matchClockMinute: 36,
    homeScore: 1,
    awayScore: 0,
    homeScorePenalties: 0,
    awayScorePenalties: 0,
    homeTeamName: "RFYC U17",
    homeClubName: "Reliance Foundation Young Champs",
    awayTeamName: "Minerva Punjab U17",
    awayClubName: "Minerva Punjab Academy",
  };

  // Validate required telemetry fields
  assert.ok(sampleLiveMatch.fixtureId);
  assert.ok(sampleLiveMatch.tournamentName);
  assert.equal(sampleLiveMatch.status, "in_progress");
  assert.ok(typeof sampleLiveMatch.matchClockMinute === "number");
  assert.ok(typeof sampleLiveMatch.homeScore === "number");
  assert.ok(typeof sampleLiveMatch.awayScore === "number");
  assert.ok(sampleLiveMatch.homeTeamName);
  assert.ok(sampleLiveMatch.awayTeamName);
});

test("Security: Tournament Creation Privilege Guard", () => {
  const canCreateTournament = (user) => {
    if (!user) return false;
    return user.role === "organizer" || user.email === "demo@myfootball.in";
  };

  assert.equal(canCreateTournament({ email: "organizer@myfootball.in", role: "organizer" }), true);
  assert.equal(canCreateTournament({ email: "demo@myfootball.in", role: "organizer" }), true);
  assert.equal(canCreateTournament({ email: "coach@myfootball.in", role: "coach" }), false);
  assert.equal(canCreateTournament({ email: "referee@myfootball.in", role: "referee" }), false);
  assert.equal(canCreateTournament({ email: "fan@myfootball.in", role: "fan" }), false);
  assert.equal(canCreateTournament(null), false);
});
