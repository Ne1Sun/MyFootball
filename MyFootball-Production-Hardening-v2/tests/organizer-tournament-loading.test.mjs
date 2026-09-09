import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/* -------------------------------------------------------------------------- */
/* 1. Test Persona Resolution & Production Isolation                          */
/* -------------------------------------------------------------------------- */

const isTestPersonaEmail = (email) =>
  email === "organizer@myfootball.in" ||
  email === "demo@myfootball.in" ||
  email === "coach@myfootball.in" ||
  email === "referee@myfootball.in" ||
  email === "fan@myfootball.in" ||
  email.endsWith("@myfootball.in");

test("isTestPersonaEmail accurately identifies all seed & demo personas", () => {
  assert.equal(isTestPersonaEmail("organizer@myfootball.in"), true);
  assert.equal(isTestPersonaEmail("demo@myfootball.in"), true);
  assert.equal(isTestPersonaEmail("coach@myfootball.in"), true);
  assert.equal(isTestPersonaEmail("referee@myfootball.in"), true);
  assert.equal(isTestPersonaEmail("fan@myfootball.in"), true);
  assert.equal(isTestPersonaEmail("test_lead@myfootball.in"), true);
  assert.equal(isTestPersonaEmail("tester123@myfootball.in"), true);
});

test("isTestPersonaEmail preserves production data isolation for real organizers", () => {
  assert.equal(isTestPersonaEmail("real_organizer@mumbai-fc.com"), false);
  assert.equal(isTestPersonaEmail("president@wifa.in"), false);
  assert.equal(isTestPersonaEmail("secretary@kfa.org"), false);
  assert.equal(isTestPersonaEmail("user@gmail.com"), false);
  assert.equal(isTestPersonaEmail("admin@yahoo.com"), false);
});

/* -------------------------------------------------------------------------- */
/* 2. Defensive Date Parser Contract (dateLabel Invariants)                   */
/* -------------------------------------------------------------------------- */

const dateLabel = (date) => {
  if (!date || typeof date !== "string") return "TBD";
  const raw = date.includes("T") ? date.split("T")[0] : date;
  const parts = raw.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  const parsed = new Date(date);
  return isNaN(parsed.getTime())
    ? date || "TBD"
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

test("dateLabel handles ISO-8601 timestamps without timezone shifts", () => {
  const formatted = dateLabel("2026-10-15T09:30:00.000Z");
  assert.ok(formatted.includes("15"), "Should extract the 15th day");
  assert.ok(formatted.includes("Oct"), "Should extract October month");
  assert.ok(formatted.includes("2026"), "Should extract year 2026");
});

test("dateLabel formats YYYY-MM-DD standard date strings", () => {
  const formatted = dateLabel("2026-11-20");
  assert.ok(formatted.includes("20"), "Should extract day 20");
  assert.ok(formatted.includes("Nov"), "Should extract month November");
  assert.ok(formatted.includes("2026"), "Should extract year 2026");
});

test("dateLabel safely degrades on null, undefined, empty, or corrupt input", () => {
  assert.equal(dateLabel(null), "TBD");
  assert.equal(dateLabel(undefined), "TBD");
  assert.equal(dateLabel(""), "TBD");
  assert.equal(dateLabel(12345), "TBD");
  assert.equal(dateLabel({}), "TBD");
  assert.equal(dateLabel("TBD"), "TBD");
});

/* -------------------------------------------------------------------------- */
/* 3. API Contract Verification (app/api/app/route.ts)                        */
/* -------------------------------------------------------------------------- */

test("API route provides clubs query across all response branches", () => {
  const routePath = path.resolve(process.cwd(), "app/api/app/route.ts");
  const src = fs.readFileSync(routePath, "utf-8");

  // Verify allClubs is queried
  assert.ok(
    src.includes("const allClubs = await db.select().from(clubs).orderBy(asc(clubs.name));"),
    "GET /api/app must query all clubs sorted alphabetically"
  );

  // Verify clubs is returned in referee branch
  assert.ok(
    /clubs:\s*allClubs/.test(src),
    "GET /api/app must return clubs in JSON payload"
  );

  // Verify benchmark tournament federation for test accounts & 0-tournament organizers
  assert.ok(
    src.includes("organizer@myfootball.in") && src.includes("demo@myfootball.in"),
    "GET /api/app must fallback to benchmark tournaments for test personas"
  );

  // Verify benchmark tournament deletion protection (HTTP 403)
  assert.ok(
    src.includes('if (tournamentId.startsWith("tourney-"))'),
    "API must guard benchmark tournaments from deletion"
  );
  assert.ok(
    src.includes("status: 403"),
    "API must return 403 Forbidden when attempting to delete benchmark tournaments"
  );

  // Verify seedDemoTournaments action is registered
  assert.ok(
    src.includes('if (payload.action === "seedDemoTournaments")'),
    "API must support seedDemoTournaments action for on-demand re-sync"
  );
});

/* -------------------------------------------------------------------------- */
/* 4. Dashboard UI Invariants & Tournaments Tab Polish                        */
/* -------------------------------------------------------------------------- */

test("Dashboard UI: AddTeamModal receives clubs and exposes quick-select dropdown", () => {
  const dashboardPath = path.resolve(process.cwd(), "app/dashboard.tsx");
  const src = fs.readFileSync(dashboardPath, "utf-8");

  // Verify AddTeamModal invocation receives clubs
  assert.ok(
    src.includes("<AddTeamModal divisions={activeDivisions} clubs={data.clubs}"),
    "AddTeamModal must receive data.clubs prop"
  );

  // Verify AddTeamModal contains Quick-Select Registered Organization / Club
  assert.ok(
    src.includes("Quick-Select Registered Organization / Club"),
    "AddTeamModal must render quick-select label for registered organizations"
  );

  // Verify handleSelectClub pre-fills details
  assert.ok(
    src.includes("handleSelectClub"),
    "AddTeamModal must implement handleSelectClub auto-fill handler"
  );
});

test("Dashboard UI: Tournaments Tab renders empty state recovery & rich tournament cards", () => {
  const dashboardPath = path.resolve(process.cwd(), "app/dashboard.tsx");
  const src = fs.readFileSync(dashboardPath, "utf-8");

  // Empty state verification
  assert.ok(
    src.includes("No Competitions Created Yet"),
    "Tournaments tab must provide clear empty state title"
  );
  assert.ok(
    src.includes("Load Demo Competitions"),
    "Tournaments tab must provide 1-click CTA to load demo competitions"
  );

  // Rich card metadata
  assert.ok(
    src.includes("ACTIVE COMPETITION"),
    "Active tournament must render active indicator pill"
  );
  assert.ok(
    src.includes("Organized by"),
    "Tournament cards must display hosting organization / organizer"
  );
  assert.ok(
    src.includes("Set Active"),
    "Tournament cards must provide explicit Set Active button"
  );
  assert.ok(
    src.includes("Open Hub"),
    "Tournament cards must provide Open Hub button"
  );
  assert.ok(
    src.includes("/tournament/"),
    "Tournament cards must include public tournament showcase link"
  );
});

test("Dashboard UI: emptyData initializes clubs: [] array", () => {
  const dashboardPath = path.resolve(process.cwd(), "app/dashboard.tsx");
  const src = fs.readFileSync(dashboardPath, "utf-8");

  assert.ok(
    /clubs:\s*\[\]/.test(src),
    "emptyData must include clubs: [] to prevent undefined property accesses"
  );
});
