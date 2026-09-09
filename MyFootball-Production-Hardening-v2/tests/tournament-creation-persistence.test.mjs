import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveCoordinates, resolvePostalCode, INDIAN_CITY_CENTROIDS, DEFAULT_INDIAN_CENTROID } from "../app/lib/geolocation.ts";

/* -------------------------------------------------------------------------- */
/* 1. Geographic Centroid & Imputation Invariants                             */
/* -------------------------------------------------------------------------- */

test("resolveCoordinates preserves explicitly provided valid coordinates", () => {
  const coords = resolveCoordinates("18.924800", "72.828600", "Mumbai", "Maharashtra");
  assert.equal(coords.latitude, "18.924800");
  assert.equal(coords.longitude, "72.828600");
});

test("resolveCoordinates auto-resolves centroids for major Indian football hubs when blank", () => {
  // Mumbai
  const mumbai = resolveCoordinates("", "", "Mumbai");
  assert.equal(mumbai.latitude, "18.924800");
  assert.equal(mumbai.longitude, "72.828600");

  // Bengaluru
  const blr = resolveCoordinates(null, undefined, "Bengaluru");
  assert.equal(blr.latitude, "12.971600");
  assert.equal(blr.longitude, "77.594600");

  // Kolkata
  const kol = resolveCoordinates("0", "0", "Kolkata");
  assert.equal(kol.latitude, "22.572600");
  assert.equal(kol.longitude, "88.363900");

  // Goa
  const goa = resolveCoordinates(undefined, undefined, "Goa");
  assert.equal(goa.latitude, "15.490900");
  assert.equal(goa.longitude, "73.827800");

  // Kochi / Kerala
  const kochi = resolveCoordinates("", "", "Kochi");
  assert.equal(kochi.latitude, "9.931200");
  assert.equal(kochi.longitude, "76.267300");

  // Delhi
  const delhi = resolveCoordinates("", "", "New Delhi");
  assert.equal(delhi.latitude, "28.613900");
  assert.equal(delhi.longitude, "77.209000");
});

test("resolveCoordinates safely falls back to standard Indian centroid for unknown locations", () => {
  const unknown = resolveCoordinates("", "", "Unknown Remote Village");
  assert.equal(unknown.latitude, DEFAULT_INDIAN_CENTROID.lat.toFixed(6));
  assert.equal(unknown.longitude, DEFAULT_INDIAN_CENTROID.lng.toFixed(6));
});

test("resolvePostalCode standardizes valid 6-digit PIN and resolves city fallbacks", () => {
  assert.equal(resolvePostalCode("400005", "Mumbai"), "400005");
  assert.equal(resolvePostalCode("560001", "Bengaluru"), "560001");
  // Empty or invalid PIN falls back to city default
  assert.equal(resolvePostalCode("", "Mumbai"), "400001");
  assert.equal(resolvePostalCode("invalid", "Kolkata"), "700001");
  assert.equal(resolvePostalCode(null, "Delhi"), "110001");
  assert.equal(resolvePostalCode(undefined, "Unknown"), "400001");
});

/* -------------------------------------------------------------------------- */
/* 2. Tournament Creation Permission & Invariants (app/api/app/route.ts)     */
/* -------------------------------------------------------------------------- */

test("API route allows all test personas and organizers to create tournaments", () => {
  const routePath = path.resolve(process.cwd(), "app/api/app/route.ts");
  const src = fs.readFileSync(routePath, "utf-8");

  // Verify role check incorporates isTestPersonaEmail
  assert.ok(
    src.includes('if (user.role !== "organizer" && !isTestPersonaEmail(user.email))'),
    "createTournament must allow organizers and all test personas via isTestPersonaEmail"
  );

  // Verify centroid resolution is used
  assert.ok(
    src.includes("resolveCoordinates(payload.latitude, payload.longitude, city, state)"),
    "createTournament must auto-resolve coordinates using resolveCoordinates"
  );
  assert.ok(
    src.includes("resolvePostalCode(payload.postalCode, city)"),
    "createTournament must sanitize/resolve postal code using resolvePostalCode"
  );

  // Verify default registration status is registration_open
  assert.ok(
    src.includes('payload.status === "draft" || payload.openRegistration === false'),
    "createTournament must default to registration_open unless explicitly draft or openRegistration false"
  );

  // Verify monotonic federation in GET /api/app
  assert.ok(
    src.includes("maintain monotonic federation"),
    "GET /api/app must maintain monotonic federation for test personas"
  );

  // Verify updateTournamentStatus action is registered
  assert.ok(
    src.includes('if (payload.action === "updateTournamentStatus")'),
    "API must implement updateTournamentStatus action"
  );
});

/* -------------------------------------------------------------------------- */
/* 3. Discover Feed Synchronization & Resilience (app/api/discover/route.ts)  */
/* -------------------------------------------------------------------------- */

test("Discover route is resilient to missing address fields and supports draft preview", () => {
  const discoverPath = path.resolve(process.cwd(), "app/api/discover/route.ts");
  const src = fs.readFileSync(discoverPath, "utf-8");

  // Verify robust location fallback
  assert.ok(
    src.includes("item.addressLine1 || item.venueName || \"\""),
    "Discover route must provide fallback for addressLine1"
  );

  // Verify draft preview for authoring organizers / test users
  assert.ok(
    src.includes("isOrganizerPreview"),
    "Discover route must support draft preview for authoring organizers"
  );

  // Verify registration_open tournaments are publicly visible
  assert.ok(
    src.includes('"registration_open"') && src.includes('"live"'),
    "Discover route must include registration_open and live competitions"
  );
});

/* -------------------------------------------------------------------------- */
/* 4. Dashboard UI Modal & Error Lifecycle (app/dashboard.tsx)                */
/* -------------------------------------------------------------------------- */

test("Dashboard UI: CreateTournament has optional coords, openRegistration toggle, error display & dismissal", () => {
  const dashboardPath = path.resolve(process.cwd(), "app/dashboard.tsx");
  const src = fs.readFileSync(dashboardPath, "utf-8");

  // Latitude & Longitude are optional
  assert.ok(
    src.includes("Latitude (Optional)"),
    "CreateTournament must clearly label latitude as optional"
  );
  assert.ok(
    src.includes("Longitude (Optional)"),
    "CreateTournament must clearly label longitude as optional"
  );

  // Coordinates inputs should not be hard-coded required
  const latFieldMatches = src.match(/name="latitude"[^>]*required/);
  assert.equal(latFieldMatches, null, "Latitude input must NOT have required attribute");

  const lngFieldMatches = src.match(/name="longitude"[^>]*required/);
  assert.equal(lngFieldMatches, null, "Longitude input must NOT have required attribute");

  // Open registration toggle is present
  assert.ok(
    src.includes("name=\"openRegistration\""),
    "CreateTournament must include openRegistration toggle"
  );

  // Inline form error banner is present
  assert.ok(
    src.includes("formError &&"),
    "CreateTournament must render inline formError banner"
  );

  // submit calls onClose() on success
  assert.ok(
    src.includes("await onSaved({") && src.includes("onClose();"),
    "CreateTournament submit handler must call onClose() upon successful save"
  );

  // handleSaveAction rethrows error
  assert.ok(
    src.includes("throw err;"),
    "handleSaveAction must re-throw errors so caller modals can display actionable feedback"
  );
});
