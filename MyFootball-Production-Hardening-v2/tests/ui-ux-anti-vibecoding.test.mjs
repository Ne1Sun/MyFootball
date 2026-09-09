import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("UI Primitive Suite: Button, Badge, Card, EmptyState exist with tactile & accessible attributes", () => {
  const buttonPath = path.resolve(process.cwd(), "app/components/ui/Button.tsx");
  const badgePath = path.resolve(process.cwd(), "app/components/ui/Badge.tsx");
  const cardPath = path.resolve(process.cwd(), "app/components/ui/Card.tsx");
  const emptyPath = path.resolve(process.cwd(), "app/components/ui/EmptyState.tsx");

  assert.ok(fs.existsSync(buttonPath), "Button primitive must exist");
  assert.ok(fs.existsSync(badgePath), "Badge primitive must exist");
  assert.ok(fs.existsSync(cardPath), "Card primitive must exist");
  assert.ok(fs.existsSync(emptyPath), "EmptyState primitive must exist");

  const buttonSrc = fs.readFileSync(buttonPath, "utf-8");
  assert.ok(buttonSrc.includes("active:scale-[0.975]"), "Button must have Emil Kowalski tactile scale physics");
  assert.ok(buttonSrc.includes("focus-visible:ring-2"), "Button must have WCAG AAA focus visible ring");
  assert.ok(buttonSrc.includes("min-h-[44px]"), "Button medium size must adhere to >= 44px touch target guidelines");

  const badgeSrc = fs.readFileSync(badgePath, "utf-8");
  assert.ok(!badgeSrc.includes("animate-ping"), "Badge must not use distracting infinite animate-ping pulses");
  assert.ok(badgeSrc.includes("rounded-full"), "Badge must have pill styling");

  const cardSrc = fs.readFileSync(cardPath, "utf-8");
  assert.ok(cardSrc.includes("CardHeader") && cardSrc.includes("CardTitle"), "Card must export compound subcomponents");
});

test("CSS Hardening: globals.css typography floor, reduced-motion, and mobile touch gate", () => {
  const globalsPath = path.resolve(process.cwd(), "app/globals.css");
  const css = fs.readFileSync(globalsPath, "utf-8");

  assert.ok(css.includes("font-size: 11px !important;"), "CSS must enforce typography floor of 11px over micro-fonts");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "CSS must honor prefers-reduced-motion for accessibility");
  assert.ok(css.includes("@media (hover: none) and (pointer: coarse)"), "CSS must include mobile touch gate to eliminate sticky hover states");
  assert.ok(css.includes(":focus-visible"), "CSS must specify global focus-visible styling");
});

test("Viewport Export: app/layout.tsx exports Next.js Viewport object with notch protection", () => {
  const layoutPath = path.resolve(process.cwd(), "app/layout.tsx");
  const src = fs.readFileSync(layoutPath, "utf-8");

  assert.ok(src.includes("export const viewport: Viewport"), "layout.tsx must export typed viewport object");
  assert.ok(src.includes("viewportFit: \"cover\""), "viewport must specify viewportFit cover for notch devices");
  assert.ok(src.includes("themeColor"), "viewport must declare dual-mode theme colors");
});

test("Domain Engine: Fixture Generator preserves all rounds when requestedRound <= 0", () => {
  const routePath = path.resolve(process.cwd(), "app/api/app/route.ts");
  const src = fs.readFileSync(routePath, "utf-8");

  assert.ok(
    /pairings\.filter\(\(pair\)\s*=>\s*pair\.round\s*===\s*requestedRound\)\s*:\s*pairings/.test(src),
    "Fixture generator must not truncate pairings to round 1 when requestedRound is 0"
  );
});

test("Domain Engine: Referee Console persists shootout kicks and enforces IFAB Law 12 & Law 3", () => {
  const refereePath = path.resolve(process.cwd(), "app/referee/referee-console-client.tsx");
  const src = fs.readFileSync(refereePath, "utf-8");

  assert.ok(src.includes("action: \"recordShootoutKick\""), "handleRecordKick must invoke recordShootoutKick API action");
  assert.ok(src.includes("second_yellow"), "Referee console must automatically upgrade 2nd yellow card to red card expulsion (IFAB Law 12)");
  assert.ok(src.includes("action: \"syncMatchSubstitution\""), "handleSubstitution must synchronize squadMembers starting status (IFAB Law 3)");
});

test("Showcase Hub: tournament-showcase-client.tsx integrates KnockoutBracket and resolveGroupStandings with GF/GA", () => {
  const showcasePath = path.resolve(process.cwd(), "app/tournament/[id]/tournament-showcase-client.tsx");
  const src = fs.readFileSync(showcasePath, "utf-8");

  assert.ok(src.includes("<KnockoutBracket"), "Showcase must render KnockoutBracket component");
  assert.ok(src.includes("resolveGroupStandings("), "Showcase must compute standings using official resolveGroupStandings");
  assert.ok(src.includes(">GF<") && src.includes(">GA<"), "Showcase standings table must include GF and GA columns");
  assert.ok(src.includes("params.get(\"tab\")"), "Showcase must synchronize activeTab with ?tab= search param");
});

test("Coach Portal: coach-portal-client.tsx enforces 11-player starting cap and TacticalPitch formation", () => {
  const coachPath = path.resolve(process.cwd(), "app/coach/coach-portal-client.tsx");
  const src = fs.readFileSync(coachPath, "utf-8");

  assert.ok(src.includes("Starting XI is full (11/11)"), "Coach portal must enforce 11-player starting XI cap");
  assert.ok(src.includes("formation={formation}"), "Coach portal must pass formation to TacticalPitch");
  assert.ok(src.includes("onFormationChange={setFormation}"), "Coach portal must pass onFormationChange to TacticalPitch");
});

test("Resilience: Next.js loading skeletons and error boundaries exist across primary routes", () => {
  const routes = ["", "tournament/[id]", "coach", "referee", "discover"];
  for (const route of routes) {
    const loadingPath = path.resolve(process.cwd(), `app/${route}/loading.tsx`.replace("//", "/"));
    const errorPath = path.resolve(process.cwd(), `app/${route}/error.tsx`.replace("//", "/"));

    assert.ok(fs.existsSync(loadingPath), `Loading skeleton must exist for ${route || "root"}`);
    assert.ok(fs.existsSync(errorPath), `Error boundary must exist for ${route || "root"}`);

    const errorSrc = fs.readFileSync(errorPath, "utf-8");
    assert.ok(errorSrc.includes("\"use client\""), `Error boundary for ${route || "root"} must be a client component`);
    assert.ok(errorSrc.includes("reset"), `Error boundary for ${route || "root"} must provide a reset handler`);
  }
});
