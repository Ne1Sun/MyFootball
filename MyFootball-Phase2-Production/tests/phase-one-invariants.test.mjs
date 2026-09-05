import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public tournament API does not expose team payment state", async () => {
  const route = await source("app/api/public/tournaments/[id]/route.ts");
  assert.doesNotMatch(route, /paymentStatus:\s*entries\.paymentStatus/);
});

test("public and coach announcements have separate audience boundaries", async () => {
  const publicRoute = await source("app/api/public/tournaments/[id]/route.ts");
  const coachData = await source("app/lib/coach-data.ts");
  assert.match(publicRoute, /eq\(announcements\.audience,\s*"all_participants"\)/);
  assert.match(coachData, /\["all_participants",\s*"coaches_only"\]/);
});

test("the bracket UI cannot manually override the verified winner", async () => {
  const bracket = await source("app/components/brackets/KnockoutBracket.tsx");
  assert.doesNotMatch(bracket, /advanceBracketWinner/);
  assert.match(bracket, /advanced automatically|winner advances/i);
});

test("referee scoring is driven by match events, not score buttons", async () => {
  const refereeConsole = await source("app/referee/referee-console-client.tsx");
  assert.doesNotMatch(refereeConsole, /handleScoreAdjust/);
  assert.match(refereeConsole, /recordDetailedMatchEvent/);
});
