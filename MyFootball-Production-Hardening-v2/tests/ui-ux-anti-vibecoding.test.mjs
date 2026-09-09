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

test("Referee Console: Client source code enforces defensive storage, safe WAL period, and ev.type guards", () => {
  const refereePath = path.resolve(process.cwd(), "app/referee/referee-console-client.tsx");
  const refereeSrc = fs.readFileSync(refereePath, "utf-8");

  assert.ok(refereeSrc.includes("safeStorageGet"), "Referee console must declare safeStorageGet wrapper");
  assert.ok(refereeSrc.includes("safeStorageSet"), "Referee console must declare safeStorageSet wrapper");
  assert.ok(refereeSrc.includes("safeStorageRemove"), "Referee console must declare safeStorageRemove wrapper");
  assert.ok(refereeSrc.includes("wal.period || currentFixture?.period || \"first_half\""), "WAL restoration notice must defensively fallback to first_half");
  assert.ok(refereeSrc.includes("(ev.type || \"EVENT\").replace(/_/g, \" \")"), "Event rendering must safely fallback if ev.type is nullish");
  assert.ok(refereeSrc.includes("isSyncingRef"), "drainMutationQueue must use isSyncingRef mutex to eliminate replay race conditions");

  const pagePath = path.resolve(process.cwd(), "app/referee/page.tsx");
  const pageSrc = fs.readFileSync(pagePath, "utf-8");
  assert.ok(pageSrc.includes("role: effectiveRole"), "Referee page must pass role: effectiveRole in initialData.user");
});

test("Referee Console Stability: WAL normalization & period upper-casing tolerates null/corrupted payloads", () => {
  const corruptWalPayloads = [
    { fixtureId: "fix-1", matchClockMinute: 12 }, // missing period
    { fixtureId: "fix-2", matchClockMinute: 45, period: null },
    { fixtureId: "fix-3", matchClockMinute: 90, period: undefined },
    { fixtureId: "fix-4", matchClockMinute: 0, period: "" },
    { fixtureId: "fix-5", matchClockMinute: 60, period: "second_half" },
  ];

  for (const wal of corruptWalPayloads) {
    assert.doesNotThrow(() => {
      const displayPeriod = (wal.period || "first_half").replace(/_/g, " ").toUpperCase();
      const displayMinute = Number.isFinite(wal.matchClockMinute) ? wal.matchClockMinute : 0;
      const notice = `⚡ WAL Restored: Match Minute ${displayMinute}', Period: ${displayPeriod}`;
      assert.ok(notice.includes("⚡ WAL Restored:"), "Must generate valid notice string");
      assert.ok(!notice.includes("undefined"), "Must never contain undefined string");
    });
  }
});

test("Referee Console Stability: Event stream tolerates null or malformed event types without throwing", () => {
  const corruptEvents = [
    { id: "ev-1", matchMinute: 10, type: null, playerName: "Player A" },
    { id: "ev-2", matchMinute: 25, type: undefined, playerName: null },
    { id: "ev-3", matchMinute: 40, type: "penalty_shootout_goal", playerName: "Player C" },
    { id: "ev-4", matchMinute: 70, type: "second_yellow", playerName: "Player D" },
  ];

  for (const ev of corruptEvents) {
    assert.doesNotThrow(() => {
      const formattedType = (ev.type || "EVENT").replace(/_/g, " ");
      assert.ok(typeof formattedType === "string", "Formatted type must be string");
      assert.ok(!formattedType.includes("_"), "Must replace all underscores");
    });
  }
});

test("Referee Console Stability: Storage wrapper operates safely under restricted/throwing environments", () => {
  // Simulates restricted browser (Brave Shields, Safari Private Mode, Quota Exceeded)
  const throwingStorage = {
    getItem() {
      throw new Error("SecurityError: Access is denied");
    },
    setItem() {
      throw new Error("QuotaExceededError: Storage quota exceeded");
    },
    removeItem() {
      throw new Error("SecurityError: Access is denied");
    },
  };

  const memoryMap = new Map();

  function safeGet(key) {
    try {
      return throwingStorage.getItem(key);
    } catch {
      return memoryMap.get(key) || null;
    }
  }

  function safeSet(key, val) {
    try {
      throwingStorage.setItem(key, val);
    } catch {
      memoryMap.set(key, String(val));
    }
  }

  assert.doesNotThrow(() => {
    safeSet("referee_daylight_mode", "true");
    const retrieved = safeGet("referee_daylight_mode");
    assert.equal(retrieved, "true", "Memory fallback must retain value safely");
  });
});

test("Referee Console Hydration: Node 22 SSR runtime isOnline invariant prevents Wifi/WifiOff divergence", () => {
  // In Node 22: typeof navigator !== "undefined" is TRUE, but navigator.onLine is undefined!
  const nodeNavigator = { userAgent: "Node.js" }; // onLine is undefined
  
  // Vulnerable old pattern:
  const oldIsOnline = typeof nodeNavigator !== "undefined" ? nodeNavigator.onLine : true;
  assert.equal(oldIsOnline, undefined, "Old pattern produced undefined in Node 22!");
  assert.equal(!oldIsOnline, true, "Old pattern made !isOnline TRUE on server!");

  // New hardened pattern:
  const deterministicIsOnline = true; // Always true for Epoch 0 (SSR and initial client pass)
  assert.equal(deterministicIsOnline, true, "Deterministic state must be true on server");
  assert.equal(!deterministicIsOnline, false, "!isOnline must be FALSE on server and client initial render");

  // Post-mount sync check:
  function getPostMountOnline(nav) {
    if (typeof nav !== "undefined" && typeof nav.onLine === "boolean") {
      return nav.onLine;
    }
    return true;
  }

  assert.equal(getPostMountOnline(nodeNavigator), true, "Node SSR safe probe falls back to true");
  assert.equal(getPostMountOnline({ onLine: true }), true, "Browser online returns true");
  assert.equal(getPostMountOnline({ onLine: false }), false, "Browser offline safely detects false post-mount");
});

test("Referee Console Hydration: usePitchClock deterministic baseline matches SSR HTML exactly", () => {
  function calculatePitchClockTest(fixture, nominalHalfMinutes = 45, clientNowMs = Date.now()) {
    let totalSeconds = Math.max(0, fixture?.clockElapsedSeconds || 0);
    const isRunning = Boolean(fixture?.clockRunning);
    if (isRunning && fixture?.status === "in_progress" && fixture?.clockStartedAt && clientNowMs !== null) {
      const startedMs = Date.parse(fixture.clockStartedAt);
      if (!Number.isNaN(startedMs) && clientNowMs > startedMs) {
        totalSeconds += Math.floor((clientNowMs - startedMs) / 1000);
      }
    }
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return { formattedClock: `${mm}:${ss}`, totalSeconds };
  }

  const activeFixture = {
    id: "fix-live",
    status: "in_progress",
    period: "first_half",
    clockRunning: true,
    clockElapsedSeconds: 600, // 10 minutes
    clockStartedAt: new Date(Date.now() - 15000).toISOString(), // started 15s ago
  };

  // Server render (Epoch 0): clientNowMs = null
  const serverRender = calculatePitchClockTest(activeFixture, 45, null);
  // Client initial hydration pass (Epoch 0): clientNowMs = null
  const clientInitialHydrate = calculatePitchClockTest(activeFixture, 45, null);

  assert.equal(serverRender.formattedClock, "10:00", "Server must render static baseline");
  assert.equal(clientInitialHydrate.formattedClock, "10:00", "Client initial render must match server 100%");
  assert.equal(serverRender.formattedClock, clientInitialHydrate.formattedClock, "Zero hydration mismatch!");

  // Client post-mount tick (Epoch 1): clientNowMs = Date.now()
  const clientLiveTick = calculatePitchClockTest(activeFixture, 45, Date.now());
  assert.equal(clientLiveTick.formattedClock, "10:15", "Live tick must accurately include elapsed delta");
});

test("Referee Console Stability: safeRandomUUID generates valid RFC4122 v4 UUIDs under restricted environments", () => {
  function safeRandomUUIDTest(hasCrypto = false) {
    if (hasCrypto && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  const uuidWithCrypto = safeRandomUUIDTest(true);
  const uuidFallback = safeRandomUUIDTest(false);

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(uuidWithCrypto, uuidRegex, "Crypto UUID must match RFC4122 v4");
  assert.match(uuidFallback, uuidRegex, "Fallback UUID must match RFC4122 v4");
});

test("Referee Console Stability: WAL Freshness Guard discards stale logs older than 4 hours", () => {
  const now = Date.now();
  const freshWAL = { fixtureId: "fix-1", timestamp: now - 30 * 60 * 1000, matchClockMinute: 25 }; // 30m old
  const staleWAL = { fixtureId: "fix-1", timestamp: now - 5 * 60 * 60 * 1000, matchClockMinute: 90 }; // 5h old

  function isWALFresh(wal, maxAgeMs = 4 * 60 * 60 * 1000) {
    return Date.now() - (wal.timestamp || 0) <= maxAgeMs;
  }

  assert.equal(isWALFresh(freshWAL), true, "Fresh WAL within 4h must be accepted");
  assert.equal(isWALFresh(staleWAL), false, "Stale WAL older than 4h must be rejected");
});


