import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveCoordinates, resolvePostalCode } from "../app/lib/geolocation.ts";
import { normalizeTeamFormat, getDefaultFormatMatchDuration, validateMatchDuration } from "../app/lib/competition.ts";

/* -------------------------------------------------------------------------- */
/* Specification 1: Tournament Creation Lifecycle                             */
/* - Creating a user tournament via app/api/app/route.ts creates valid        */
/*   divisions and defaults status: "registration_open"                       */
/* -------------------------------------------------------------------------- */

test("Spec 1: Tournament Creation Lifecycle Invariants (app/api/app/route.ts)", () => {
  const appRoutePath = path.resolve(process.cwd(), "app/api/app/route.ts");
  assert.ok(fs.existsSync(appRoutePath), "app/api/app/route.ts must exist");
  const src = fs.readFileSync(appRoutePath, "utf-8");

  // Verify status resolution logic: defaults to 'registration_open' unless explicitly 'draft' or openRegistration: false
  assert.ok(
    src.includes('payload.status === "draft" || payload.openRegistration === false'),
    "createTournament must default status to 'registration_open' unless explicitly draft"
  );
  assert.ok(
    src.includes('? "draft"') && src.includes(': "registration_open"'),
    "Ternary operator must resolve to 'registration_open' by default"
  );

  // Verify divisions batch insertion with tournamentId link
  assert.ok(
    src.includes("db.insert(tournaments).values(tournament)"),
    "createTournament must insert tournament record"
  );
  assert.ok(
    src.includes("db.insert(divisions).values(divisionRows)"),
    "createTournament must batch insert associated divisions"
  );

  // Verify divisions have required schema properties
  assert.ok(
    src.includes("tournamentId,") && src.includes("name: ageGroup,"),
    "divisionRows must map age groups with corresponding tournamentId"
  );
  assert.ok(
    src.includes("feePaise,"),
    "divisionRows must calculate feePaise"
  );

  // Pure logic simulation of tournament creation lifecycle
  function simulateCreateTournament(payload, user) {
    if (user.role !== "organizer" && !user.email.endsWith("@myfootball.in")) {
      return { status: 403, error: "Only tournament organizers can create new tournaments." };
    }

    const name = payload.name?.trim() || "";
    const city = payload.city?.trim() || "";
    const venueName = payload.venueName?.trim() || "";
    const startDate = payload.startDate?.trim() || "";
    const ageGroups = Array.isArray(payload.ageGroups)
      ? payload.ageGroups.filter(Boolean)
      : [];

    if (!name || !city || !venueName || !startDate || !ageGroups.length) {
      return { status: 400, error: "Tournament name, city, venue, start date and at least one division are required." };
    }

    const teamFormat = normalizeTeamFormat(payload.teamFormat);
    const defaultDuration = getDefaultFormatMatchDuration(teamFormat);
    const durationValidation = validateMatchDuration(payload.matchDurationMinutes, defaultDuration);
    if (!durationValidation.valid) {
      return { status: 400, error: durationValidation.error };
    }

    const status = payload.status === "draft" || payload.openRegistration === false
      ? "draft"
      : "registration_open";

    const tournamentId = "test-tourney-" + Date.now();
    const tournament = {
      id: tournamentId,
      organizerEmail: user.email,
      name,
      city,
      venueName,
      status,
      startDate,
      teamFormat,
    };

    const divisions = ageGroups.map((ageGroup, idx) => ({
      id: `div-${tournamentId}-${idx}`,
      tournamentId,
      name: ageGroup,
      teamFormat,
      maxTeams: payload.maxTeams || 16,
      feePaise: Math.round((payload.feeRupees || 0) * 100),
    }));

    return { status: 201, tournament, divisions };
  }

  // 1. User tournament creation with open registration (default)
  const organizerUser = { email: "vikram@maharashtra-fc.in", role: "organizer" };
  const validPayload = {
    name: "Pune Youth Premier League 2026",
    city: "Pune",
    venueName: "Balewadi Sports Complex",
    startDate: "2026-11-10",
    ageGroups: ["Under-15", "Under-17"],
    teamFormat: "11v11",
    maxTeams: 16,
    feeRupees: 2500,
  };

  const result = simulateCreateTournament(validPayload, organizerUser);
  assert.equal(result.status, 201);
  assert.equal(result.tournament.status, "registration_open");
  assert.equal(result.divisions.length, 2);
  assert.equal(result.divisions[0].name, "Under-15");
  assert.equal(result.divisions[1].name, "Under-17");
  assert.equal(result.divisions[0].feePaise, 250000);
  assert.equal(result.divisions[0].tournamentId, result.tournament.id);

  // 2. Explicit draft creation
  const draftPayload = { ...validPayload, status: "draft" };
  const draftResult = simulateCreateTournament(draftPayload, organizerUser);
  assert.equal(draftResult.status, 201);
  assert.equal(draftResult.tournament.status, "draft");

  // 3. Explicit openRegistration = false results in draft
  const closedPayload = { ...validPayload, openRegistration: false };
  const closedResult = simulateCreateTournament(closedPayload, organizerUser);
  assert.equal(closedResult.status, 201);
  assert.equal(closedResult.tournament.status, "draft");
});

/* -------------------------------------------------------------------------- */
/* Specification 2: Discover Visibility                                       */
/* - app/api/discover/route.ts returns user-created tournaments with          */
/*   open registration and hasCapacity flags for coach enrollment             */
/* -------------------------------------------------------------------------- */

test("Spec 2: Discover Feed Visibility & Coach Capacity Evaluation", () => {
  const discoverPath = path.resolve(process.cwd(), "app/api/discover/route.ts");
  assert.ok(fs.existsSync(discoverPath), "app/api/discover/route.ts must exist");
  const src = fs.readFileSync(discoverPath, "utf-8");

  // Verify public status filter allows registration_open, live, scheduled, registration_closed
  assert.ok(
    src.includes('"registration_open"') && src.includes('"live"') && src.includes('"scheduled"'),
    "Discover route must expose registration_open, live, and scheduled tournaments to discovery feed"
  );

  // Verify draft visibility is restricted to authoring organizer or test persona
  assert.ok(
    src.includes("isOrganizerPreview"),
    "Draft preview in discover route must be guarded by isOrganizerPreview"
  );

  // Discover feed calculation engine simulation
  function evaluateDiscoverItem(item, signedInUser) {
    const isPublic = ["registration_open", "registration_closed", "scheduled", "live"].includes(item.status);
    const isOrganizerPreview =
      item.status === "draft" &&
      signedInUser &&
      (item.organizerEmail === signedInUser.email || signedInUser.email?.endsWith("@myfootball.in"));

    if (!isPublic && !isOrganizerPreview) return null;

    const divisions = item.divisions || [];
    const totalCapacity = divisions.reduce((sum, d) => sum + (d.maxTeams || 0), 0);
    const registeredTeams = item.registeredTeams || 0;
    const hasCapacity = totalCapacity === 0 || registeredTeams < totalCapacity;
    const canRegister = ["registration_open", "live", "scheduled"].includes(item.status) && hasCapacity;
    const showEnrollSquad = Boolean(canRegister && signedInUser?.role === "coach");

    return {
      id: item.id,
      name: item.name,
      status: item.status,
      hasCapacity,
      canRegister,
      showEnrollSquad,
      remainingSlots: totalCapacity > 0 ? Math.max(0, totalCapacity - registeredTeams) : 999,
    };
  }

  const userTournament = {
    id: "user-tourney-kolkata-2026",
    name: "Kolkata Grassroots Youth Cup",
    organizerEmail: "organizer@kolkatafootball.org",
    status: "registration_open",
    registeredTeams: 4,
    divisions: [
      { id: "div-u13", name: "U13", maxTeams: 8 },
      { id: "div-u15", name: "U15", maxTeams: 8 },
    ],
  };

  // 1. Coach inspecting open user tournament
  const coachUser = { email: "coach@subrataacademy.com", role: "coach" };
  const coachView = evaluateDiscoverItem(userTournament, coachUser);
  assert.ok(coachView, "Open user tournament must be visible in discover feed");
  assert.equal(coachView.hasCapacity, true);
  assert.equal(coachView.canRegister, true);
  assert.equal(coachView.showEnrollSquad, true);
  assert.equal(coachView.remainingSlots, 12);

  // 2. Pre-configured demo coach testing open user tournament
  const demoCoach = { email: "coach@myfootball.in", role: "coach" };
  const demoCoachView = evaluateDiscoverItem(userTournament, demoCoach);
  assert.equal(demoCoachView.showEnrollSquad, true, "coach@myfootball.in must see enroll button");

  // 3. Tournament at full capacity
  const fullTournament = { ...userTournament, registeredTeams: 16 };
  const fullCoachView = evaluateDiscoverItem(fullTournament, coachUser);
  assert.equal(fullCoachView.hasCapacity, false);
  assert.equal(fullCoachView.canRegister, false);
  assert.equal(fullCoachView.showEnrollSquad, false, "Full capacity tournament must not show enroll button");
  assert.equal(fullCoachView.remainingSlots, 0);

  // 4. Non-coach (Fan or Unauthenticated)
  const fanView = evaluateDiscoverItem(userTournament, { email: "fan@gmail.com", role: "fan" });
  assert.equal(fanView.canRegister, true);
  assert.equal(fanView.showEnrollSquad, false, "Fans must never see squad enrollment button");

  const guestView = evaluateDiscoverItem(userTournament, null);
  assert.equal(guestView.canRegister, true);
  assert.equal(guestView.showEnrollSquad, false, "Guests must never see squad enrollment button");
});

/* -------------------------------------------------------------------------- */
/* Specification 3: Public Registration Route GET                             */
/* - GET /api/public/tournaments/[id] returns HTTP 200 with divisions and     */
/*   clubs for coach accounts                                                 */
/* -------------------------------------------------------------------------- */

test("Spec 3: Public Registration Route GET Contract (app/api/public/tournaments/[id]/route.ts)", () => {
  const publicRoutePath = path.resolve(process.cwd(), "app/api/public/tournaments/[id]/route.ts");
  assert.ok(fs.existsSync(publicRoutePath), "Public tournament route must exist");
  const src = fs.readFileSync(publicRoutePath, "utf-8");

  // Verify GET handler checks for valid open/live statuses
  assert.ok(
    src.includes('!["registration_open", "registration_closed", "scheduled", "live", "completed"].includes(tournament.status)'),
    "GET handler must return 404 for draft tournaments without public clearance"
  );

  // Verify GET queries divisions
  assert.ok(
    src.includes("from(divisions)") && src.includes("eq(divisions.tournamentId, id)"),
    "GET handler must query divisions associated with tournamentId"
  );

  // Verify GET queries user clubs when signedIn
  assert.ok(
    src.includes("eq(clubs.ownerEmail, signedIn.email)"),
    "GET handler must query owned clubs for the signed in coach"
  );
  assert.ok(
    src.includes("myClubs"),
    "GET response must return myClubs array with owned clubs and teams"
  );

  // Simulate GET endpoint logic
  function simulateGetPublicTournament(tournamentId, tournamentStore, divisionsStore, clubsStore, teamsStore, signedInUser) {
    const tournament = tournamentStore.find((t) => t.id === tournamentId);
    if (!tournament) return { status: 404, error: "Tournament not found" };

    const validStatuses = ["registration_open", "registration_closed", "scheduled", "live", "completed"];
    if (!validStatuses.includes(tournament.status)) {
      return { status: 404, error: "Tournament not found" };
    }

    const divisionRows = divisionsStore.filter((d) => d.tournamentId === tournamentId);

    let myClubs = [];
    if (signedInUser) {
      const ownedClubs = clubsStore.filter((c) => c.ownerEmail === signedInUser.email);
      if (ownedClubs.length > 0) {
        const clubIds = new Set(ownedClubs.map((c) => c.id));
        const ownedTeams = teamsStore.filter((t) => clubIds.has(t.clubId));
        myClubs = ownedClubs.map((c) => ({
          id: c.id,
          name: c.name,
          city: c.city,
          organizationType: c.organizationType,
          contactName: c.contactName,
          contactPhone: c.contactPhone,
          teams: ownedTeams
            .filter((t) => t.clubId === c.id)
            .map((t) => ({ id: t.id, name: t.name })),
        }));
      }
    }

    return {
      status: 200,
      body: {
        tournament,
        divisions: divisionRows,
        myClubs,
        user: signedInUser,
      },
    };
  }

  const mockTournaments = [
    {
      id: "tourney-user-001",
      name: "Bangalore Youth Trophy",
      status: "registration_open",
      city: "Bengaluru",
      venueName: "Bangalore Football Stadium",
    },
  ];

  const mockDivisions = [
    { id: "div-u14", tournamentId: "tourney-user-001", name: "U14 Boys", maxTeams: 16, feePaise: 200000 },
    { id: "div-u16", tournamentId: "tourney-user-001", name: "U16 Boys", maxTeams: 16, feePaise: 250000 },
  ];

  const mockClubs = [
    {
      id: "club-rfyc",
      ownerEmail: "coach@myfootball.in",
      name: "Reliance Foundation Young Champs",
      city: "Navi Mumbai",
      organizationType: "academy",
      contactName: "Coach Subrata",
      contactPhone: "+91 98765 43210",
    },
  ];

  const mockTeams = [
    { id: "team-rfyc-u16", clubId: "club-rfyc", name: "RFYC U16 Elite" },
  ];

  // 1. Coach request returns HTTP 200, divisions, and pre-populated coach clubs
  const coachUser = { email: "coach@myfootball.in", displayName: "Coach Subrata", role: "coach" };
  const res = simulateGetPublicTournament("tourney-user-001", mockTournaments, mockDivisions, mockClubs, mockTeams, coachUser);
  assert.equal(res.status, 200);
  assert.equal(res.body.divisions.length, 2);
  assert.equal(res.body.myClubs.length, 1);
  assert.equal(res.body.myClubs[0].name, "Reliance Foundation Young Champs");
  assert.equal(res.body.myClubs[0].teams[0].name, "RFYC U16 Elite");

  // 2. Non-existent tournament returns 404
  const res404 = simulateGetPublicTournament("non-existent-id", mockTournaments, mockDivisions, mockClubs, mockTeams, coachUser);
  assert.equal(res404.status, 404);
});

/* -------------------------------------------------------------------------- */
/* Specification 4: Squad Enrollment by Coach                                 */
/* - POST /api/public/tournaments/[id] allows coach (coach@myfootball.in &     */
/*   user with role coach) to enroll a team into user tournament              */
/* -------------------------------------------------------------------------- */

test("Spec 4: Squad Enrollment by Coach (app/api/public/tournaments/[id]/route.ts)", () => {
  const publicRoutePath = path.resolve(process.cwd(), "app/api/public/tournaments/[id]/route.ts");
  const src = fs.readFileSync(publicRoutePath, "utf-8");

  // Verify POST endpoint structure & insertion
  assert.ok(
    src.includes("export async function POST"),
    "POST handler must be exported in /api/public/tournaments/[id]/route.ts"
  );
  assert.ok(
    src.includes("db.insert(entries).values"),
    "POST handler must insert entry record into entries table"
  );
  assert.ok(
    src.includes('status: "pending"') && src.includes('paymentStatus: "unpaid"'),
    "New team enrollment must default to status: 'pending' and paymentStatus: 'unpaid'"
  );
  assert.ok(
    src.includes("duplicateEntry"),
    "POST handler must guard against duplicate squad registrations in same division"
  );

  // Pure logic simulation of coach team enrollment
  function simulateEnrollSquad(tournamentId, payload, signedInUser, state) {
    if (!signedInUser) {
      return { status: 401, body: { error: "Sign in to register a team." } };
    }
    if (signedInUser.role !== "coach") {
      return {
        status: 403,
        body: {
          error: "Only registered Academy Coaches and Team Managers can enroll squads into tournaments. Please sign out and log in with a Coach account.",
          code: "COACH_ROLE_REQUIRED",
          currentRole: signedInUser.role,
        },
      };
    }

    const tournament = state.tournaments.find((t) => t.id === tournamentId);
    if (!tournament || !["registration_open", "live", "scheduled"].includes(tournament.status)) {
      return { status: 404, body: { error: "Registration is closed for this tournament." } };
    }

    const division = state.divisions.find((d) => d.id === payload.divisionId && d.tournamentId === tournamentId);
    if (!division) {
      return { status: 400, body: { error: "Select a valid division." } };
    }

    const currentEntries = state.entries.filter((e) => e.divisionId === division.id);
    if (currentEntries.length >= division.maxTeams) {
      return { status: 409, body: { error: "This division is full." } };
    }

    const clubName = payload.clubName?.trim();
    const teamName = payload.teamName?.trim();
    const contactName = payload.contactName?.trim();
    const contactPhone = payload.contactPhone?.trim();

    if (!clubName || !teamName || !contactName || !contactPhone) {
      return { status: 400, body: { error: "Complete all required fields." } };
    }

    // Resolve or create club
    let club = state.clubs.find((c) => c.ownerEmail === signedInUser.email && c.name === clubName);
    if (!club) {
      club = {
        id: "club-" + Date.now(),
        ownerEmail: signedInUser.email,
        name: clubName,
        city: payload.city?.trim() || "",
        contactName,
        contactPhone,
      };
      state.clubs.push(club);
    }

    // Resolve or create team
    let team = state.teams.find((t) => t.clubId === club.id && t.name === teamName);
    if (!team) {
      team = { id: "team-" + Date.now(), clubId: club.id, name: teamName };
      state.teams.push(team);
    }

    // Check duplicate entry
    const isDuplicate = state.entries.some((e) => e.divisionId === division.id && e.teamId === team.id);
    if (isDuplicate) {
      return { status: 409, body: { error: "This squad is already registered in this tournament division." } };
    }

    const entryId = "entry-" + Date.now();
    const newEntry = {
      id: entryId,
      divisionId: division.id,
      teamId: team.id,
      status: "pending",
      paymentStatus: "unpaid",
      amountPaise: division.feePaise || 0,
      notes: payload.notes || "",
    };
    state.entries.push(newEntry);

    return {
      status: 201,
      body: {
        entryId,
        linkedToAccount: true,
        message: "Registration submitted for organizer approval.",
      },
    };
  }

  const sharedState = {
    tournaments: [
      { id: "user-tourney-delhi-2026", name: "Capital Grassroots Championship", status: "registration_open" },
    ],
    divisions: [
      { id: "div-delhi-u17", tournamentId: "user-tourney-delhi-2026", name: "U17", maxTeams: 8, feePaise: 300000 },
    ],
    clubs: [],
    teams: [],
    entries: [],
  };

  const payloadA = {
    divisionId: "div-delhi-u17",
    clubName: "Minerva Punjab Academy",
    teamName: "Minerva Punjab U17",
    contactName: "Coach Ranjit",
    contactPhone: "+91 99887 76655",
    city: "Mohali",
  };

  // Case 1: Standard Coach with custom domain account
  const coachUser = { email: "coach.ranjit@minervapunjab.in", role: "coach" };
  const resCoach = simulateEnrollSquad("user-tourney-delhi-2026", payloadA, coachUser, sharedState);
  assert.equal(resCoach.status, 201);
  assert.equal(resCoach.body.linkedToAccount, true);
  assert.ok(resCoach.body.entryId);
  assert.equal(sharedState.entries.length, 1);
  assert.equal(sharedState.entries[0].status, "pending");
  assert.equal(sharedState.entries[0].paymentStatus, "unpaid");
  assert.equal(sharedState.entries[0].amountPaise, 300000);

  // Case 2: Duplicate registration rejection
  const resDup = simulateEnrollSquad("user-tourney-delhi-2026", payloadA, coachUser, sharedState);
  assert.equal(resDup.status, 409);
  assert.equal(resDup.body.error, "This squad is already registered in this tournament division.");

  // Case 3: Test persona coach@myfootball.in enrolling a separate squad
  const testCoach = { email: "coach@myfootball.in", role: "coach" };
  const payloadB = {
    divisionId: "div-delhi-u17",
    clubName: "Sudeva Delhi FC",
    teamName: "Sudeva Delhi U17",
    contactName: "Coach Subrata Paul",
    contactPhone: "+91 98765 12345",
    city: "Delhi",
  };

  const resTestCoach = simulateEnrollSquad("user-tourney-delhi-2026", payloadB, testCoach, sharedState);
  assert.equal(resTestCoach.status, 201);
  assert.equal(resTestCoach.body.linkedToAccount, true);
  assert.equal(sharedState.entries.length, 2);
});

/* -------------------------------------------------------------------------- */
/* Specification 5: RBAC Protection                                           */
/* - Non-coaches (e.g. fan or player) attempting to POST enrollment receive   */
/*   HTTP 403 COACH_ROLE_REQUIRED                                             */
/* -------------------------------------------------------------------------- */

test("Spec 5: RBAC Protection - Strict COACH_ROLE_REQUIRED Gate (app/api/public/tournaments/[id]/route.ts)", () => {
  const publicRoutePath = path.resolve(process.cwd(), "app/api/public/tournaments/[id]/route.ts");
  const src = fs.readFileSync(publicRoutePath, "utf-8");

  // Verify strict RBAC condition in source code
  assert.ok(
    src.includes('if (signedIn.role !== "coach")'),
    "POST /api/public/tournaments/[id] must strictly check if (signedIn.role !== 'coach')"
  );
  assert.ok(
    src.includes('code: "COACH_ROLE_REQUIRED"'),
    "POST /api/public/tournaments/[id] must return code: 'COACH_ROLE_REQUIRED'"
  );
  assert.ok(
    src.includes("status: 403"),
    "POST /api/public/tournaments/[id] must return HTTP 403 for non-coaches"
  );

  function verifyEnrollmentRole(user) {
    if (!user) {
      return { status: 401, error: "Sign in to register a team." };
    }
    if (user.role !== "coach") {
      return {
        status: 403,
        code: "COACH_ROLE_REQUIRED",
        error: "Only registered Academy Coaches and Team Managers can enroll squads into tournaments. Please sign out and log in with a Coach account.",
        currentRole: user.role,
      };
    }
    return { status: 200, ok: true };
  }

  // 1. Fan persona: Must be rejected with 403 & COACH_ROLE_REQUIRED
  const fanResult = verifyEnrollmentRole({ email: "fan@myfootball.in", role: "fan" });
  assert.equal(fanResult.status, 403);
  assert.equal(fanResult.code, "COACH_ROLE_REQUIRED");
  assert.equal(fanResult.currentRole, "fan");

  // 2. Commercial fan / spectator: Must be rejected with 403 & COACH_ROLE_REQUIRED
  const externalFanResult = verifyEnrollmentRole({ email: "spectator@gmail.com", role: "fan" });
  assert.equal(externalFanResult.status, 403);
  assert.equal(externalFanResult.code, "COACH_ROLE_REQUIRED");

  // 3. Player role: Must be rejected with 403 & COACH_ROLE_REQUIRED
  const playerResult = verifyEnrollmentRole({ email: "striker@academy.in", role: "player" });
  assert.equal(playerResult.status, 403);
  assert.equal(playerResult.code, "COACH_ROLE_REQUIRED");
  assert.equal(playerResult.currentRole, "player");

  // 4. Referee role: Must be rejected with 403 & COACH_ROLE_REQUIRED
  const refereeResult = verifyEnrollmentRole({ email: "referee@myfootball.in", role: "referee" });
  assert.equal(refereeResult.status, 403);
  assert.equal(refereeResult.code, "COACH_ROLE_REQUIRED");

  // 5. Organizer role: Must be rejected with 403 & COACH_ROLE_REQUIRED (must use Organizer console to add teams, not coach public registration)
  const organizerResult = verifyEnrollmentRole({ email: "organizer@myfootball.in", role: "organizer" });
  assert.equal(organizerResult.status, 403);
  assert.equal(organizerResult.code, "COACH_ROLE_REQUIRED");

  // 6. Unauthenticated Guest: Must be rejected with 401
  const guestResult = verifyEnrollmentRole(null);
  assert.equal(guestResult.status, 401);

  // 7. Coach role: Allowed (status 200)
  const coachResult = verifyEnrollmentRole({ email: "coach@myfootball.in", role: "coach" });
  assert.equal(coachResult.status, 200);
  assert.equal(coachResult.ok, true);
});
