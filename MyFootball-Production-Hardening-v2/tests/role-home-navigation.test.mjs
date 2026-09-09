import test from "node:test";
import assert from "node:assert/strict";
import { getRoleHomePath, getNavItems } from "../app/lib/navigation.ts";

test("getRoleHomePath: Persona Destination Invariants", () => {
  // Unauthenticated / new guest visitor
  assert.equal(getRoleHomePath(null), "/", "Unauthenticated user home path must be /");
  assert.equal(getRoleHomePath(undefined), "/", "Undefined role home path must be /");
  assert.equal(getRoleHomePath(""), "/", "Empty string role home path must be /");

  // Coach and Fan
  assert.equal(getRoleHomePath("coach"), "/discover", "Coach home path must be /discover");
  assert.equal(getRoleHomePath("COACH"), "/discover", "Case-insensitive coach home path must be /discover");
  assert.equal(getRoleHomePath("fan"), "/discover", "Fan home path must be /discover");
  assert.equal(getRoleHomePath("FAN"), "/discover", "Case-insensitive fan home path must be /discover");

  // Referee
  assert.equal(getRoleHomePath("referee"), "/referee", "Referee home path must be /referee");
  assert.equal(getRoleHomePath("REFEREE"), "/referee", "Case-insensitive referee home path must be /referee");

  // Organizer
  assert.equal(getRoleHomePath("organizer"), "/organize", "Organizer home path must be /organize");
  assert.equal(getRoleHomePath("ORGANIZER"), "/organize", "Case-insensitive organizer home path must be /organize");

  // Safe lattice bottom fallback
  assert.equal(getRoleHomePath("unknown_role"), "/discover", "Unrecognized role must fall back safely to /discover");
});

test("getNavItems: Unauthenticated Guest Navigation", () => {
  const guestItems = getNavItems(null);
  assert.equal(guestItems.length, 2, "Guests must see exactly 2 navigation items");

  const homeItem = guestItems.find((item) => item.id === "home");
  assert.ok(homeItem, "Guests must see the public Home tab");
  assert.equal(homeItem.href, "/", "Public Home tab must link to /");
  assert.equal(homeItem.label, "Home");

  const discoverItem = guestItems.find((item) => item.id === "discover");
  assert.ok(discoverItem, "Guests must see the Discover tab");
  assert.equal(discoverItem.href, "/discover", "Discover tab must link to /discover");
});

test("getNavItems: Coach Session Navigation Isolation", () => {
  const coachItems = getNavItems({ role: "coach" });
  assert.equal(coachItems.length, 2, "Coach must see Discover and Coach Hub tabs");

  // Invariant: Public Home tab MUST NOT exist for authenticated coach
  const homeTab = coachItems.find((item) => item.href === "/" || item.id === "home");
  assert.equal(homeTab, undefined, "Public Home tab must strictly NOT be present for Coach");

  assert.equal(coachItems[0].id, "discover");
  assert.equal(coachItems[0].href, "/discover");
  assert.equal(coachItems[1].id, "coach");
  assert.equal(coachItems[1].href, "/coach");
  assert.equal(coachItems[1].label, "Coach Hub");
});

test("getNavItems: Fan Session Navigation Isolation", () => {
  const fanItems = getNavItems({ role: "fan" });
  assert.equal(fanItems.length, 1, "Fan must see Discover as their primary home tab");

  // Invariant: Public Home tab MUST NOT exist for authenticated fan
  const homeTab = fanItems.find((item) => item.href === "/" || item.id === "home");
  assert.equal(homeTab, undefined, "Public Home tab must strictly NOT be present for Fan");

  assert.equal(fanItems[0].id, "discover");
  assert.equal(fanItems[0].href, "/discover");
});

test("getNavItems: Referee Session Navigation Isolation", () => {
  const refereeItems = getNavItems({ role: "referee" });
  assert.equal(refereeItems.length, 2, "Referee must see Referee Console and Discover tabs");

  // Invariant: Public Home tab MUST NOT exist for authenticated referee
  const homeTab = refereeItems.find((item) => item.href === "/" || item.id === "home");
  assert.equal(homeTab, undefined, "Public Home tab must strictly NOT be present for Referee");

  assert.equal(refereeItems[0].id, "referee");
  assert.equal(refereeItems[0].href, "/referee");
  assert.equal(refereeItems[0].label, "Referee Console");
  assert.equal(refereeItems[1].id, "discover");
  assert.equal(refereeItems[1].href, "/discover");
});

test("getNavItems: Organizer Session Navigation Isolation", () => {
  const organizerItems = getNavItems({ role: "organizer" });
  assert.equal(organizerItems.length, 2, "Organizer must see Organizer Hub and Discover tabs");

  // Invariant: Public Home tab MUST NOT exist for authenticated organizer
  const homeTab = organizerItems.find((item) => item.href === "/" || item.id === "home");
  assert.equal(homeTab, undefined, "Public Home tab must strictly NOT be present for Organizer");

  assert.equal(organizerItems[0].id, "organize");
  assert.equal(organizerItems[0].href, "/organize");
  assert.equal(organizerItems[0].label, "Organizer Hub");
  assert.equal(organizerItems[1].id, "discover");
  assert.equal(organizerItems[1].href, "/discover");
});

test("Root Route Simulation: Redirection Decision Engine", () => {
  function simulateRootRedirect(user) {
    if (!user) return null; // Renders public landing page (HTTP 200)
    const role = user.role?.toLowerCase() || "fan";
    switch (role) {
      case "organizer":
        return "/organize";
      case "referee":
        return "/referee";
      case "coach":
      case "fan":
      default:
        return "/discover";
    }
  }

  // Crawlers & Unauthenticated visitors
  assert.equal(simulateRootRedirect(null), null, "Unauthenticated visitors render public page without redirect");

  // Role redirections
  assert.equal(simulateRootRedirect({ role: "coach" }), "/discover");
  assert.equal(simulateRootRedirect({ role: "fan" }), "/discover");
  assert.equal(simulateRootRedirect({ role: "referee" }), "/referee");
  assert.equal(simulateRootRedirect({ role: "organizer" }), "/organize");
  assert.equal(simulateRootRedirect({ role: "other" }), "/discover");
});
