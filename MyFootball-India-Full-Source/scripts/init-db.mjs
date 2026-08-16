import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbDir = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const files = fs.readdirSync(dbDir).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
if (files.length === 0) {
  files.push("faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite");
}

console.log("Target DB files:", files);

for (const file of files) {
  const dbPath = path.join(dbDir, file);
  console.log("Applying schema to:", dbPath);
  const db = new DatabaseSync(dbPath);

  // Apply migrations
  const m1 = fs.readFileSync(path.resolve("drizzle/0000_fair_grim_reaper.sql"), "utf8");
  const m2 = fs.readFileSync(path.resolve("drizzle/0001_tearful_black_cat.sql"), "utf8");
  const m3 = fs.existsSync(path.resolve("drizzle/0002_rich_squads_and_matchday.sql"))
    ? fs.readFileSync(path.resolve("drizzle/0002_rich_squads_and_matchday.sql"), "utf8")
    : "";

  const statements = (m1 + "\n--> statement-breakpoint\n" + m2 + "\n--> statement-breakpoint\n" + m3)
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sql of statements) {
    try {
      db.exec(sql);
    } catch {
      // Ignore if table/column already exists
    }
  }

  // Ensure all columns exist in case table was created previously without new columns
  const alterStatements = [
    "ALTER TABLE divisions ADD COLUMN groups_count integer DEFAULT 2 NOT NULL",
    "ALTER TABLE divisions ADD COLUMN teams_advancing_per_group integer DEFAULT 2 NOT NULL",
    "ALTER TABLE entries ADD COLUMN group_name text DEFAULT 'Group A' NOT NULL",
    "ALTER TABLE fixtures ADD COLUMN stage text DEFAULT 'group' NOT NULL",
    "ALTER TABLE fixtures ADD COLUMN bracket_round text",
    "ALTER TABLE fixtures ADD COLUMN bracket_match_index integer",
    "ALTER TABLE fixtures ADD COLUMN period text DEFAULT 'scheduled' NOT NULL",
    "ALTER TABLE fixtures ADD COLUMN match_clock_minute integer DEFAULT 0 NOT NULL",
    "ALTER TABLE fixtures ADD COLUMN home_score_penalties integer DEFAULT 0 NOT NULL",
    "ALTER TABLE fixtures ADD COLUMN away_score_penalties integer DEFAULT 0 NOT NULL",
    "ALTER TABLE fixtures ADD COLUMN potm_player_id text",
    "ALTER TABLE fixtures ADD COLUMN potm_player_name text DEFAULT '' NOT NULL",
    "ALTER TABLE match_events ADD COLUMN player_id text",
    "ALTER TABLE match_events ADD COLUMN assist_player_name text DEFAULT '' NOT NULL",
    "ALTER TABLE match_events ADD COLUMN assist_player_id text",
    "ALTER TABLE match_events ADD COLUMN match_period text DEFAULT 'first_half' NOT NULL",
    "ALTER TABLE match_events ADD COLUMN card_reason text DEFAULT '' NOT NULL",
  ];
  for (const sql of alterStatements) {
    try { db.exec(sql); } catch {}
  }

  // Ensure players and squad_members tables exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id text PRIMARY KEY NOT NULL,
        club_id text NOT NULL,
        name text NOT NULL,
        date_of_birth text,
        jersey_number integer DEFAULT 0 NOT NULL,
        position text DEFAULT 'MID' NOT NULL,
        is_captain integer DEFAULT 0 NOT NULL,
        photo_url text DEFAULT '' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS squad_members (
        id text PRIMARY KEY NOT NULL,
        entry_id text NOT NULL,
        player_id text NOT NULL,
        is_starting integer DEFAULT 0 NOT NULL,
        jersey_number_override integer,
        position_override text,
        registered_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
  } catch {}

  const countStmt = db.prepare("SELECT COUNT(*) as count FROM players");
  const countResult = countStmt.get();
  console.log("Player count in DB:", countResult.count);

  if (countResult.count === 0) {
    console.log("Seeding rich Indian football tournament ecosystem (players, squads, brackets)...");
    const now = new Date().toISOString();

    // 1. Seed user
    db.prepare(`
      INSERT OR IGNORE INTO users (email, full_name, role, preferred_state, preferred_city, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("demo@myfootball.in", "Demo Organizer", "organizer", "Maharashtra", "Mumbai", now, now);

    // 2. Seed primary tournament
    const tourneyId = "tourney-mumbai-super-cup-2026";
    db.prepare(`
      INSERT OR REPLACE INTO tournaments (
        id, organizer_email, name, organized_by, city, venue_name, address_line_1,
        locality, state, postal_code, latitude, longitude, start_date, duration_days,
        status, contact_name, contact_phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tourneyId, "demo@myfootball.in", "Mumbai Super Cup 2026", "Western India Football Association",
      "Mumbai", "Cooperage Football Ground", "Madame Cama Road, Colaba", "Colaba", "Maharashtra",
      "400001", "18.924800", "72.828600", "2026-09-01", 5, "live", "Sunil Fernandes", "+91 98200 12345",
      now, now
    );

    // 3. Seed divisions
    const divU17 = `${tourneyId}-u17`;
    db.prepare(`
      INSERT OR REPLACE INTO divisions (
        id, tournament_id, name, format, max_squad_size, max_teams, groups_count, teams_advancing_per_group,
        fee_paise, fee_basis, require_players, require_documents, win_points, draw_points, loss_points, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      divU17, tourneyId, "Under-17 Premier Division", "group_knockout", 18, 8, 2, 2,
      350000, "per_team", 1, 0, 3, 1, 0, now
    );

    // 4. Seed Clubs & Teams
    const clubsData = [
      { id: "club-rfyc", name: "Reliance Foundation Young Champs", city: "Navi Mumbai", teamId: "team-rfyc", teamName: "RFYC U17", group: "Group A", seed: 1 },
      { id: "club-minerva", name: "Minerva Punjab Academy", city: "Mohali", teamId: "team-minerva", teamName: "Minerva Punjab U17", group: "Group B", seed: 1 },
      { id: "club-bfc", name: "Bengaluru FC Academy", city: "Bengaluru", teamId: "team-bfc", teamName: "BFC Blues U17", group: "Group A", seed: 2 },
      { id: "club-dempo", name: "Dempo SC Juniors", city: "Panaji", teamId: "team-dempo", teamName: "Dempo Golden Eagles", group: "Group B", seed: 2 },
      { id: "club-mcfc", name: "Mumbai City FC Youth", city: "Mumbai", teamId: "team-mcfc", teamName: "MCFC Islanders U17", group: "Group A", seed: 3 },
      { id: "club-sudeva", name: "Sudeva Delhi FC", city: "New Delhi", teamId: "team-sudeva", teamName: "Sudeva Delhi U17", group: "Group B", seed: 3 },
      { id: "club-gokulam", name: "Gokulam Kerala FC", city: "Kozhikode", teamId: "team-gokulam", teamName: "Malabarians U17", group: "Group A", seed: 4 },
      { id: "club-eastbengal", name: "East Bengal FC Academy", city: "Kolkata", teamId: "team-eastbengal", teamName: "Red & Gold Brigade", group: "Group B", seed: 4 },
    ];

    const insertClub = db.prepare(`INSERT OR REPLACE INTO clubs (id, owner_email, name, organization_type, city, contact_name, contact_phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertTeam = db.prepare(`INSERT OR REPLACE INTO teams (id, club_id, name, created_at) VALUES (?, ?, ?, ?)`);
    const insertEntry = db.prepare(`INSERT OR REPLACE INTO entries (id, division_id, team_id, status, payment_status, amount_paise, seed, group_name, notes, registered_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertPlayer = db.prepare(`INSERT OR REPLACE INTO players (id, club_id, name, date_of_birth, jersey_number, position, is_captain, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertSquadMember = db.prepare(`INSERT OR REPLACE INTO squad_members (id, entry_id, player_id, is_starting, registered_at) VALUES (?, ?, ?, ?, ?)`);

    const playersList = [
      // RFYC
      { id: "p-rf-1", clubId: "club-rfyc", name: "Aarav Sharma", dob: "2009-04-12", num: 10, pos: "FWD", cap: 1, entryId: "entry-team-rfyc", start: 1 },
      { id: "p-rf-2", clubId: "club-rfyc", name: "Rohan Desai", dob: "2009-08-20", num: 7, pos: "MID", cap: 0, entryId: "entry-team-rfyc", start: 1 },
      { id: "p-rf-3", clubId: "club-rfyc", name: "Harsh Patel", dob: "2009-02-15", num: 1, pos: "GK", cap: 0, entryId: "entry-team-rfyc", start: 1 },
      { id: "p-rf-4", clubId: "club-rfyc", name: "Siddharth Rao", dob: "2009-06-30", num: 4, pos: "DEF", cap: 0, entryId: "entry-team-rfyc", start: 1 },
      { id: "p-rf-5", clubId: "club-rfyc", name: "Vikrant Kulkarni", dob: "2009-11-05", num: 9, pos: "FWD", cap: 0, entryId: "entry-team-rfyc", start: 0 },
      // Minerva
      { id: "p-min-1", clubId: "club-minerva", name: "Gurpreet Singh", dob: "2009-01-22", num: 9, pos: "FWD", cap: 1, entryId: "entry-team-minerva", start: 1 },
      { id: "p-min-2", clubId: "club-minerva", name: "Manpreet Sandhu", dob: "2009-05-14", num: 11, pos: "MID", cap: 0, entryId: "entry-team-minerva", start: 1 },
      { id: "p-min-3", clubId: "club-minerva", name: "Jaswinder Gill", dob: "2009-09-10", num: 1, pos: "GK", cap: 0, entryId: "entry-team-minerva", start: 1 },
      { id: "p-min-4", clubId: "club-minerva", name: "Harjot Bains", dob: "2009-07-04", num: 5, pos: "DEF", cap: 0, entryId: "entry-team-minerva", start: 1 },
      // BFC
      { id: "p-bfc-1", clubId: "club-bfc", name: "Nikhil Gowda", dob: "2009-03-25", num: 10, pos: "FWD", cap: 1, entryId: "entry-team-bfc", start: 1 },
      { id: "p-bfc-2", clubId: "club-bfc", name: "Srikant Reddy", dob: "2009-06-11", num: 1, pos: "GK", cap: 0, entryId: "entry-team-bfc", start: 1 },
      { id: "p-bfc-3", clubId: "club-bfc", name: "Tejas Kumar", dob: "2009-10-02", num: 8, pos: "MID", cap: 0, entryId: "entry-team-bfc", start: 1 },
      // Dempo
      { id: "p-dmp-1", clubId: "club-dempo", name: "Ashley Coutinho", dob: "2009-05-09", num: 7, pos: "FWD", cap: 1, entryId: "entry-team-dempo", start: 1 },
      { id: "p-dmp-2", clubId: "club-dempo", name: "Shawn Fernandes", dob: "2009-07-22", num: 1, pos: "GK", cap: 0, entryId: "entry-team-dempo", start: 1 },
      { id: "p-dmp-3", clubId: "club-dempo", name: "Keith D'Souza", dob: "2009-11-14", num: 8, pos: "MID", cap: 0, entryId: "entry-team-dempo", start: 1 },
    ];

    for (const c of clubsData) {
      insertClub.run(c.id, "demo@myfootball.in", c.name, "academy", c.city, "Head Coach", "+91 98000 00000", now);
      insertTeam.run(c.teamId, c.id, c.teamName, now);
      const entryId = `entry-${c.teamId}`;
      insertEntry.run(entryId, divU17, c.teamId, "approved", "paid", 350000, c.seed, c.group, "Confirmed entry", now, now);
    }

    for (const p of playersList) {
      insertPlayer.run(p.id, p.clubId, p.name, p.dob, p.num, p.pos, p.cap, now);
      insertSquadMember.run(`sm-${p.id}`, p.entryId, p.id, p.start, now);
    }

    // 5. Seed Fixtures & Match Events (Group matches + Knockout bracket)
    const insertFixture = db.prepare(`
      INSERT OR REPLACE INTO fixtures (
        id, division_id, round_number, round_name, stage, bracket_round, bracket_match_index,
        home_entry_id, away_entry_id, kickoff_at, pitch, status, period, match_clock_minute,
        home_score, away_score, home_score_penalties, away_score_penalties, potm_player_id, potm_player_name,
        published_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEvent = db.prepare(`
      INSERT OR REPLACE INTO match_events (
        id, fixture_id, entry_id, type, player_name, player_id, assist_player_name, assist_player_id,
        related_player_name, match_minute, match_period, card_reason, recorded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Completed Group Match 1: RFYC vs BFC (2 - 0)
    const fix1 = "fix-grp-1";
    insertFixture.run(
      fix1, divU17, 1, "Group A - Matchday 1", "group", null, null,
      "entry-team-rfyc", "entry-team-bfc", "2026-09-01T09:00:00Z", 1, "completed", "completed", 90,
      2, 0, 0, 0, "p-rf-1", "Aarav Sharma", now, now
    );
    insertEvent.run("ev-1", fix1, "entry-team-rfyc", "goal", "Aarav Sharma", "p-rf-1", "Rohan Desai", "p-rf-2", "", 24, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-2", fix1, "entry-team-rfyc", "goal", "Aarav Sharma", "p-rf-1", "", null, "", 68, "second_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-3", fix1, "entry-team-bfc", "yellow_card", "Tejas Kumar", "p-bfc-3", "", null, "", 52, "second_half", "Tactical Foul", "demo@myfootball.in", now);

    // Completed Group Match 2: Minerva vs Dempo (3 - 1)
    const fix2 = "fix-grp-2";
    insertFixture.run(
      fix2, divU17, 1, "Group B - Matchday 1", "group", null, null,
      "entry-team-minerva", "entry-team-dempo", "2026-09-01T10:30:00Z", 2, "completed", "completed", 90,
      3, 1, 0, 0, "p-min-1", "Gurpreet Singh", now, now
    );
    insertEvent.run("ev-4", fix2, "entry-team-minerva", "goal", "Gurpreet Singh", "p-min-1", "Manpreet Sandhu", "p-min-2", "", 12, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-5", fix2, "entry-team-minerva", "goal", "Gurpreet Singh", "p-min-1", "", null, "", 41, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-6", fix2, "entry-team-dempo", "goal", "Ashley Coutinho", "p-dmp-1", "Keith D'Souza", "p-dmp-3", "", 55, "second_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-7", fix2, "entry-team-minerva", "goal", "Manpreet Sandhu", "p-min-2", "Gurpreet Singh", "p-min-1", "", 82, "second_half", "", "demo@myfootball.in", now);

    // Knockout Semi-Final 1: RFYC vs Dempo (Completed 2 - 1)
    const sf1 = "fix-sf-1";
    insertFixture.run(
      sf1, divU17, 2, "Semi-Final 1", "knockout", "semi_final", 1,
      "entry-team-rfyc", "entry-team-dempo", "2026-09-04T09:00:00Z", 1, "completed", "completed", 90,
      2, 1, 0, 0, "p-rf-2", "Rohan Desai", now, now
    );
    insertEvent.run("ev-8", sf1, "entry-team-rfyc", "goal", "Rohan Desai", "p-rf-2", "Aarav Sharma", "p-rf-1", "", 18, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-9", sf1, "entry-team-dempo", "goal", "Ashley Coutinho", "p-dmp-1", "", null, "", 60, "second_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-10", sf1, "entry-team-rfyc", "goal", "Aarav Sharma", "p-rf-1", "Rohan Desai", "p-rf-2", "", 88, "second_half", "", "demo@myfootball.in", now);

    // Knockout Semi-Final 2: Minerva vs BFC (1 - 1, Penalties 4 - 3)
    const sf2 = "fix-sf-2";
    insertFixture.run(
      sf2, divU17, 2, "Semi-Final 2", "knockout", "semi_final", 2,
      "entry-team-minerva", "entry-team-bfc", "2026-09-04T11:00:00Z", 1, "completed", "completed", 90,
      1, 1, 4, 3, "p-min-3", "Jaswinder Gill", now, now
    );
    insertEvent.run("ev-11", sf2, "entry-team-bfc", "goal", "Nikhil Gowda", "p-bfc-1", "", null, "", 33, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-12", sf2, "entry-team-minerva", "goal", "Gurpreet Singh", "p-min-1", "Manpreet Sandhu", "p-min-2", "", 77, "second_half", "", "demo@myfootball.in", now);

    // Knockout 3rd Place Playoff: Dempo vs BFC (Scheduled)
    const bronze = "fix-bronze";
    insertFixture.run(
      bronze, divU17, 3, "3rd Place Playoff", "knockout", "third_place", 1,
      "entry-team-dempo", "entry-team-bfc", "2026-09-05T14:00:00Z", 1, "scheduled", "scheduled", 0,
      0, 0, 0, 0, null, "", now, now
    );

    // Knockout Grand Final: RFYC vs Minerva (Live Match ready to test!)
    const final = "fix-final";
    insertFixture.run(
      final, divU17, 3, "Grand Final", "knockout", "final", 1,
      "entry-team-rfyc", "entry-team-minerva", "2026-09-05T16:30:00Z", 1, "in_progress", "first_half", 36,
      1, 0, 0, 0, null, "", now, now
    );
    insertEvent.run("ev-13", final, "entry-team-rfyc", "goal", "Aarav Sharma", "p-rf-1", "Rohan Desai", "p-rf-2", "", 19, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-14", final, "entry-team-minerva", "yellow_card", "Harjot Bains", "p-min-4", "", null, "", 31, "first_half", "Dissent", "demo@myfootball.in", now);

    // 6. Seed Announcements
    db.prepare(`
      INSERT INTO announcements (id, tournament_id, sender_email, body, audience, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      "ann-1", tourneyId, "demo@myfootball.in",
      "Welcome to the Mumbai Super Cup 2026! Grand Final between RFYC U17 and Minerva Punjab U17 is now underway on Pitch 1.",
      "all_participants", now
    );

    console.log("Seeding finished successfully with rich football ecosystem!");
  }
}
