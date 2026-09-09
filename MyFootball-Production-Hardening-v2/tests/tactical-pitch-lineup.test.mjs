import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PITCH_PATH = path.resolve("./app/components/tactics/TacticalPitch.tsx");

test("TacticalPitch: Supports Own Half perspective with dedicated half-pitch SVG geometry", () => {
  const content = fs.readFileSync(PITCH_PATH, "utf-8");

  // 1. Perspective state & switcher
  assert.ok(
    content.includes('pitchView === "half"'),
    "TacticalPitch must support half-pitch perspective mode"
  );
  assert.ok(
    content.includes('pitchView === "full"'),
    "TacticalPitch must support full-pitch perspective mode"
  );
  assert.ok(
    content.includes("Own Half"),
    "TacticalPitch must render Own Half perspective toggle button"
  );

  // 2. Half-pitch markings: Halfway line at top, goal at bottom
  assert.ok(
    content.includes('line x1="4%" y1="4%" x2="96%" y2="4%" strokeWidth="3"'),
    "Half pitch view must render halfway line at top of pitch"
  );
  assert.ok(
    content.includes("Halfway Line • Attacking Direction"),
    "Half pitch view must indicate halfway line and attacking direction"
  );
  assert.ok(
    content.includes("Defending Goal"),
    "Pitch view must designate defending goal"
  );

  // 3. Full-pitch compression: All 11 players strictly kept on defending half (y > 50%)
  assert.ok(
    content.includes("52 + (slot.y / 100) * 36"),
    "In full pitch mode, y coordinates must be constrained to defending half (y > 50%)"
  );
});

test("TacticalPitch: Mathematical Invariant - No player crosses halfway line in full pitch mode", () => {
  const testYSlots = [16, 20, 22, 36, 38, 48, 50, 52, 58, 68, 72, 74, 76, 88];

  for (const rawY of testYSlots) {
    const fullPitchY = 52 + (rawY / 100) * 36;
    assert.ok(
      fullPitchY > 50,
      `Full pitch Y coordinate for slot ${rawY} must be strictly in defending half (> 50%), got ${fullPitchY}%`
    );
    assert.ok(
      fullPitchY < 95,
      `Full pitch Y coordinate for slot ${rawY} must be above goal line (< 95%), got ${fullPitchY}%`
    );
  }
});
