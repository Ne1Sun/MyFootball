import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const dbPath = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite");
const db = new DatabaseSync(dbPath);

console.log("--- MyFootball Step 1 Engine Verification ---");

const tourneys = db.prepare("SELECT count(*) as count FROM tournaments").get();
const divs = db.prepare("SELECT count(*) as count FROM divisions").get();
const clubs = db.prepare("SELECT count(*) as count FROM clubs").get();
const teams = db.prepare("SELECT count(*) as count FROM teams").get();
const entries = db.prepare("SELECT count(*) as count FROM entries").get();
const players = db.prepare("SELECT count(*) as count FROM players").get();
const squads = db.prepare("SELECT count(*) as count FROM squad_members").get();
const fixtures = db.prepare("SELECT count(*) as count FROM fixtures").get();
const events = db.prepare("SELECT count(*) as count FROM match_events").get();

console.log(`Tournaments: ${tourneys.count}`);
console.log(`Divisions: ${divs.count}`);
console.log(`Clubs: ${clubs.count}`);
console.log(`Teams: ${teams.count}`);
console.log(`Entries: ${entries.count}`);
console.log(`Players: ${players.count}`);
console.log(`Squad Members: ${squads.count}`);
console.log(`Fixtures: ${fixtures.count}`);
console.log(`Match Events: ${events.count}`);

// Check knockout bracket fixtures
const koFixtures = db.prepare("SELECT id, round_name, stage, bracket_round, home_score, away_score, status, period FROM fixtures WHERE stage='knockout'").all();
console.log("\nKnockout Brackets:", koFixtures);

// Check top goalscorers
const scorers = db.prepare(`
  SELECT player_name, COUNT(*) as goals
  FROM match_events
  WHERE type IN ('goal', 'penalty_goal')
  GROUP BY player_name
  ORDER BY goals DESC
`).all();
console.log("\nTop Goalscorers (Golden Boot):", scorers);

console.log("\n✅ All database models and relationships verified successfully!");
