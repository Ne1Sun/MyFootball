import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, "../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite");

async function chunkedQuery(items, chunkSize = 50, queryFn) {
  if (!items || items.length === 0) return [];
  if (items.length <= chunkSize) return queryFn(items);
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  const chunkResults = await Promise.all(chunks.map((chunk) => queryFn(chunk)));
  return chunkResults.flat();
}

test("Organizer Data Pipeline: Safely loads 576 players without exceeding D1 parameter limits", async () => {
  const db = new DatabaseSync(dbPath);
  const email = "organizer@myfootball.in";

  const tournaments = db.prepare("SELECT * FROM tournaments WHERE organizer_email = ? ORDER BY created_at DESC").all(email);
  assert.ok(tournaments.length >= 4, "Expected at least 4 tournaments for organizer");

  const tournamentIds = tournaments.map((t) => t.id);
  const divisions = await chunkedQuery(tournamentIds, 50, async (chunk) => {
    const p = chunk.map(() => "?").join(",");
    return db.prepare(`SELECT * FROM divisions WHERE tournament_id IN (${p}) ORDER BY created_at ASC`).all(...chunk);
  });
  assert.ok(divisions.length >= 4, "Expected at least 4 divisions");

  const divisionIds = divisions.map((d) => d.id);
  const entries = await chunkedQuery(divisionIds, 50, async (chunk) => {
    const p = chunk.map(() => "?").join(",");
    return db.prepare(`SELECT * FROM entries WHERE division_id IN (${p})`).all(...chunk);
  });
  assert.equal(entries.length, 32, "Expected 32 approved tournament entries");

  const entryIds = entries.map((e) => e.id);
  const squadMembers = await chunkedQuery(entryIds, 50, async (chunk) => {
    const p = chunk.map(() => "?").join(",");
    return db.prepare(`SELECT * FROM squad_members WHERE entry_id IN (${p})`).all(...chunk);
  });
  assert.equal(squadMembers.length, 576, "Expected 576 squad members across 32 teams");

  const playerIds = [...new Set(squadMembers.map((s) => s.player_id))];
  assert.equal(playerIds.length, 576, "Expected 576 unique player IDs");

  // Verify all 576 players load in batches of <= 50
  const players = await chunkedQuery(playerIds, 50, async (chunk) => {
    assert.ok(chunk.length <= 50, `Chunk length ${chunk.length} exceeded D1 safe limit 50`);
    const p = chunk.map(() => "?").join(",");
    return db.prepare(`SELECT * FROM players WHERE id IN (${p}) ORDER BY jersey_number ASC, name ASC`).all(...chunk);
  });
  assert.equal(players.length, 576, "All 576 players loaded successfully");
});
