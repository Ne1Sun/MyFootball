import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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

  // Apply all migrations dynamically in sequence
  const drizzleDir = path.resolve("drizzle");
  const migrationFiles = fs.readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const statements = migrationFiles
    .flatMap((file) => {
      const content = fs.readFileSync(path.join(drizzleDir, file), "utf8");
      return content.split("--> statement-breakpoint");
    })
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
    "ALTER TABLE users ADD COLUMN password_hash text DEFAULT '' NOT NULL",
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
    "ALTER TABLE divisions ADD COLUMN match_duration_minutes integer DEFAULT 90 NOT NULL",
    "ALTER TABLE divisions ADD COLUMN half_time_break_minutes integer DEFAULT 15 NOT NULL",
    "ALTER TABLE divisions ADD COLUMN buffer_minutes integer DEFAULT 10 NOT NULL",
    "ALTER TABLE divisions ADD COLUMN min_rest_minutes integer DEFAULT 0 NOT NULL",
    "ALTER TABLE tournaments ADD COLUMN team_format text DEFAULT '11v11' NOT NULL",
    "ALTER TABLE divisions ADD COLUMN team_format text DEFAULT '11v11' NOT NULL",
    "ALTER TABLE tournaments ADD COLUMN match_duration_minutes integer DEFAULT 90 NOT NULL",
  ];
  for (const sql of alterStatements) {
    try { db.exec(sql); } catch {}
  }

  // Pre-seed or self-heal password_hash for testing personas (Grassroots@2026)
  const salt = "4b8f3a9e1d2c3b4a5e6f7a8b9c0d1e2f";
  const masterKey = crypto.pbkdf2Sync("Grassroots@2026", Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
  const masterHash = `pbkdf2$100000$${salt}$${masterKey}`;
  
  const testPersonas = [
    { email: "organizer@myfootball.in", name: "Vikramaditya Singhania", role: "organizer" },
    { email: "coach@myfootball.in", name: "Coach Subrata Paul", role: "coach" },
    { email: "referee@myfootball.in", name: "Michael Murmu (AIFF)", role: "referee" },
    { email: "fan@myfootball.in", name: "Aarav Sharma", role: "fan" },
    { email: "demo@myfootball.in", name: "Demo Organizer", role: "organizer" },
  ];
  for (const p of testPersonas) {
    try {
      db.prepare(`
        INSERT INTO users (email, full_name, role, preferred_state, preferred_city, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, 'Maharashtra', 'Mumbai', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash WHERE password_hash = '' OR password_hash IS NULL
      `).run(p.email, p.name, p.role, masterHash);
    } catch {}
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

    try {
      db.exec(`ALTER TABLE fixtures ADD COLUMN clock_started_at text;`);
    } catch {}
    try {
      db.exec(`ALTER TABLE fixtures ADD COLUMN clock_running integer DEFAULT 0 NOT NULL;`);
    } catch {}
    try {
      db.exec(`ALTER TABLE fixtures ADD COLUMN clock_elapsed_seconds integer DEFAULT 0 NOT NULL;`);
    } catch {}
    try {
      db.exec(`ALTER TABLE fixtures ADD COLUMN stoppage_minutes integer DEFAULT 0 NOT NULL;`);
    } catch {}
    try {
      db.exec(`ALTER TABLE fixtures ADD COLUMN clock_pause_reason text;`);
    } catch {}
  } catch {}

  const countStmt = db.prepare("SELECT COUNT(*) as count FROM players");
  const countResult = countStmt.get();
  console.log("Player count in DB:", countResult.count);

  const shouldSeed = process.env.MYFOOTBALL_SEED_DEMO !== "0";

  if (shouldSeed) {
    console.log("Seeding rich Indian football tournament ecosystem (Full Capacity, Squads, Simultaneous Live Matches)...");
    const now = new Date().toISOString();

    // 1. Wipe existing competition records for an authoritative, clean idempotent seed
    db.exec(`
      DELETE FROM shootout_kicks;
      DELETE FROM match_events;
      DELETE FROM squad_members;
      DELETE FROM players;
      DELETE FROM fixtures;
      DELETE FROM entries;
      DELETE FROM teams;
      DELETE FROM clubs;
      DELETE FROM divisions;
      DELETE FROM announcements;
      DELETE FROM audit_log;
      DELETE FROM follows;
      DELETE FROM tournaments;
    `);

    // 2. Prepare statements
    const insertTournament = db.prepare(`
      INSERT OR REPLACE INTO tournaments (
        id, organizer_email, name, organized_by, city, venue_name, address_line_1,
        locality, state, postal_code, latitude, longitude, start_date, duration_days,
        status, team_format, match_duration_minutes, contact_name, contact_phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDivision = db.prepare(`
      INSERT OR REPLACE INTO divisions (
        id, tournament_id, name, age_cutoff_date, team_format, format, max_squad_size, max_teams, groups_count, teams_advancing_per_group,
        fee_paise, fee_basis, require_players, require_documents, win_points, draw_points, loss_points,
        match_duration_minutes, half_time_break_minutes, buffer_minutes, min_rest_minutes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertClub = db.prepare(`
      INSERT OR REPLACE INTO clubs (id, owner_email, name, organization_type, city, contact_name, contact_phone, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTeam = db.prepare(`
      INSERT OR REPLACE INTO teams (id, club_id, name, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const insertEntry = db.prepare(`
      INSERT OR REPLACE INTO entries (id, division_id, team_id, status, payment_status, amount_paise, seed, group_name, notes, registered_at, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPlayer = db.prepare(`
      INSERT OR REPLACE INTO players (id, club_id, name, date_of_birth, jersey_number, position, is_captain, photo_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSquadMember = db.prepare(`
      INSERT OR REPLACE INTO squad_members (id, entry_id, player_id, is_starting, jersey_number_override, position_override, registered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFixture = db.prepare(`
      INSERT OR REPLACE INTO fixtures (
        id, division_id, round_number, round_name, stage, bracket_round, bracket_match_index,
        home_entry_id, away_entry_id, kickoff_at, pitch, status, period, match_clock_minute,
        clock_started_at, clock_running, clock_elapsed_seconds, stoppage_minutes, clock_pause_reason,
        home_score, away_score, home_score_penalties, away_score_penalties, potm_player_id, potm_player_name,
        published_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEvent = db.prepare(`
      INSERT OR REPLACE INTO match_events (
        id, fixture_id, entry_id, type, player_name, player_id, assist_player_name, assist_player_id,
        related_player_name, match_minute, match_period, card_reason, recorded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertShootout = db.prepare(`
      INSERT OR REPLACE INTO shootout_kicks (id, fixture_id, entry_id, player_id, sequence, scored, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertAnnouncement = db.prepare(`
      INSERT OR REPLACE INTO announcements (id, tournament_id, sender_email, body, audience, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAudit = db.prepare(`
      INSERT OR REPLACE INTO audit_log (id, tournament_id, actor_email, action, entity_type, entity_id, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertFollow = db.prepare(`
      INSERT OR REPLACE INTO follows (user_email, tournament_id, created_at)
      VALUES (?, ?, ?)
    `);

    // 3. Seed Users (personae)
    const seedUsers = [
      { email: "organizer@myfootball.in", name: "Vikramaditya Singhania", role: "organizer" },
      { email: "coach@myfootball.in", name: "Coach Subrata Paul", role: "coach" },
      { email: "referee@myfootball.in", name: "Michael Murmu (AIFF)", role: "referee" },
      { email: "fan@myfootball.in", name: "Aarav Sharma", role: "fan" },
      { email: "demo@myfootball.in", name: "Demo Organizer", role: "organizer" },
    ];
    for (const u of seedUsers) {
      db.prepare(`
        INSERT OR IGNORE INTO users (email, full_name, role, preferred_state, preferred_city, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(u.email, u.name, u.role, "Maharashtra", "Mumbai", now, now);
    }

    // 4. Regional Name Pools for Authentic Player Generation
    const regionalNames = {
      west: {
        first: ["Aarav", "Rohan", "Harsh", "Siddharth", "Vikrant", "Aditya", "Pranav", "Tanmay", "Atharva", "Omkar", "Varun", "Tejas", "Gaurav", "Sanket", "Aniket", "Kunal", "Swapnil", "Chinmay"],
        last: ["Sharma", "Desai", "Patel", "Rao", "Kulkarni", "Bheke", "Fernandes", "Jadhav", "More", "Sawant", "Gawli", "Shinde", "Thakur", "Chavan", "Pawar", "Bhosale", "Kamble", "Salunkhe"],
      },
      north: {
        first: ["Gurpreet", "Manpreet", "Jaswinder", "Harjot", "Manvir", "Harmanjot", "Anwar", "Balwant", "Sukhdev", "Dilpreet", "Jagpreet", "Navjot", "Amrinder", "Jaspal", "Bikramjit", "Gursimrat", "Prabhsukhan", "Rajinder"],
        last: ["Singh", "Sandhu", "Gill", "Bains", "Khabra", "Ali", "Bajwa", "Grewal", "Dhillon", "Sidhu", "Cheema", "Brar", "Virk", "Chahal", "Randhawa", "Pannu", "Sekhon", "Deol"],
      },
      east: {
        first: ["Subrata", "Pritam", "Debjit", "Sourav", "Aniket", "Subhashis", "Sayan", "Rahim", "Deepak", "Abhishek", "Bikash", "Surajit", "Tanmoy", "Pronay", "Alvito", "Mehtab", "Kingshuk", "Arnab"],
        last: ["Paul", "Kotal", "Majumder", "Das", "Mukherjee", "Bose", "Banerjee", "Ali", "Tangri", "Halder", "Yumnam", "Seal", "Ghosh", "Bhowmick", "Dutta", "Sarkar", "Chakraborty", "Roy"],
      },
      south: {
        first: ["Ashique", "Sahal", "Rahul", "Jithin", "Suhair", "Mohammed", "Nihal", "Bijoy", "Vibin", "Sachin", "Muhammed", "Abdul", "Arjun", "Gokul", "Naveen", "Vishnu", "Shibin", "Faslu"],
        last: ["Kuruniyan", "Samad", "KP", "MS", "VP", "Rafi", "Sudeesh", "Varghese", "Mohanan", "Suresh", "Aimen", "Rabeeh", "Jayaraj", "K", "Kumar", "Rahman", "Nazar", "Hassan"],
      },
      goa: {
        first: ["Brandon", "Liston", "Glan", "Princeton", "Saviphil", "Leander", "Climax", "Mahesh", "Devendra", "Aiban", "Rowllin", "Mandar", "Seriton", "Keegan", "Jeshurun", "Cavin", "Francis", "Romeo"],
        last: ["Fernandes", "Colaco", "Martins", "Rebello", "D'Costa", "D'Cunha", "Lawrence", "Gawli", "Murgaokar", "Dohling", "Borges", "Rao Desai", "Alvares", "Pereira", "Dias", "Lobo", "Noronha", "Carvalho"],
      },
    };

    // Helper to generate full 18-player squad strictly meeting IFAB & AIFF regulations
    function generateSquadRoster(clubId, entryId, regionKey, birthYear, teamOffset = 0) {
      const region = regionalNames[regionKey] || regionalNames.west;
      const squad = [];

      // 11 Starters (1 GK, 4 DEF, 4 MID, 2 FWD)
      const starterPositions = [
        { num: 1, pos: "GK", cap: 0 },
        { num: 2, pos: "DEF", cap: 0 },
        { num: 3, pos: "DEF", cap: 0 },
        { num: 4, pos: "DEF", cap: 1 }, // Team Captain
        { num: 5, pos: "DEF", cap: 0 },
        { num: 6, pos: "MID", cap: 0 },
        { num: 7, pos: "MID", cap: 0 },
        { num: 8, pos: "MID", cap: 0 },
        { num: 9, pos: "FWD", cap: 0 },
        { num: 10, pos: "MID", cap: 0 },
        { num: 11, pos: "FWD", cap: 0 },
      ];

      // 7 Bench Substitutes (1 Backup GK, 2 DEF, 2 MID, 2 FWD)
      const subPositions = [
        { num: 12, pos: "DEF", cap: 0 },
        { num: 13, pos: "DEF", cap: 0 },
        { num: 14, pos: "MID", cap: 0 },
        { num: 15, pos: "MID", cap: 0 },
        { num: 16, pos: "GK", cap: 0 },  // Reserve GK
        { num: 17, pos: "FWD", cap: 0 },
        { num: 18, pos: "FWD", cap: 0 },
      ];

      const allRoster = [
        ...starterPositions.map((p) => ({ ...p, isStarting: 1 })),
        ...subPositions.map((p) => ({ ...p, isStarting: 0 })),
      ];

      for (let i = 0; i < allRoster.length; i++) {
        const item = allRoster[i];
        const fnIdx = (teamOffset * 3 + i) % region.first.length;
        const lnIdx = (teamOffset * 2 + i) % region.last.length;
        const name = `${region.first[fnIdx]} ${region.last[lnIdx]}`;
        const month = String((i % 12) + 1).padStart(2, "0");
        const day = String(((i * 5) % 27) + 1).padStart(2, "0");
        const dob = `${birthYear + (i % 2 === 0 ? 0 : 1)}-${month}-${day}`;
        const playerId = `p-${clubId}-${item.num}`;

        insertPlayer.run(playerId, clubId, name, dob, item.num, item.pos, item.cap, "", now);
        insertSquadMember.run(`sm-${entryId}-${item.num}`, entryId, playerId, item.isStarting, null, null, now);
        squad.push({ id: playerId, name, num: item.num, pos: item.pos, isStarting: item.isStarting });
      }

      return squad;
    }

    // =========================================================================
    // 5. TOURNAMENT 1: Mumbai Super Cup 2026 (Live Matchday, Cooperage Ground)
    // =========================================================================
    const t1Id = "tourney-mumbai-super-cup-2026";
    insertTournament.run(
      t1Id, "organizer@myfootball.in", "Mumbai Super Cup 2026", "Western India Football Association",
      "Mumbai", "Cooperage Football Ground", "Madame Cama Road, Colaba", "Colaba", "Maharashtra",
      "400001", "18.924800", "72.828600", "2026-09-01", 10, "live", "11v11", 90,
      "Sunil Fernandes", "+91 98200 12345", now, now
    );

    const divU17Mumbai = `${t1Id}-u17`;
    insertDivision.run(
      divU17Mumbai, t1Id, "Under-17 Premier Division", "2009-01-01", "11v11", "group_knockout",
      18, 8, 2, 2, 350000, "per_team", 1, 0, 3, 1, 0, 90, 15, 10, 0, now
    );

    const t1Clubs = [
      { id: "club-rfyc", teamId: "team-rfyc", name: "Reliance Foundation Young Champs", teamName: "RFYC U17", city: "Navi Mumbai", group: "Group A", seed: 1, region: "west", owner: "coach@myfootball.in" },
      { id: "club-minerva", teamId: "team-minerva", name: "Minerva Punjab Academy", teamName: "Minerva Punjab U17", city: "Mohali", group: "Group B", seed: 1, region: "north", owner: "demo@myfootball.in" },
      { id: "club-bfc", teamId: "team-bfc", name: "Bengaluru FC Academy", teamName: "BFC Blues U17", city: "Bengaluru", group: "Group A", seed: 2, region: "south", owner: "demo@myfootball.in" },
      { id: "club-dempo", teamId: "team-dempo", name: "Dempo SC Juniors", teamName: "Dempo Golden Eagles", city: "Panaji", group: "Group B", seed: 2, region: "goa", owner: "demo@myfootball.in" },
      { id: "club-mcfc", teamId: "team-mcfc", name: "Mumbai City FC Youth", teamName: "MCFC Islanders U17", city: "Mumbai", group: "Group A", seed: 3, region: "west", owner: "demo@myfootball.in" },
      { id: "club-sudeva", teamId: "team-sudeva", name: "Sudeva Delhi FC", teamName: "Sudeva Delhi U17", city: "New Delhi", group: "Group B", seed: 3, region: "north", owner: "demo@myfootball.in" },
      { id: "club-gokulam", teamId: "team-gokulam", name: "Gokulam Kerala FC", teamName: "Malabarians U17", city: "Kozhikode", group: "Group A", seed: 4, region: "south", owner: "demo@myfootball.in" },
      { id: "club-eastbengal", teamId: "team-eastbengal", name: "East Bengal FC Academy", teamName: "Red & Gold Brigade", city: "Kolkata", group: "Group B", seed: 4, region: "east", owner: "demo@myfootball.in" },
    ];

    const t1Rosters = {};
    for (let i = 0; i < t1Clubs.length; i++) {
      const c = t1Clubs[i];
      insertClub.run(c.id, c.owner, c.name, "academy", c.city, "Head Coach", "+91 98000 00000", now);
      insertTeam.run(c.teamId, c.id, c.teamName, now);
      const entryId = `entry-${c.teamId}`;
      insertEntry.run(entryId, divU17Mumbai, c.teamId, "approved", "paid", 350000, c.seed, c.group, "Confirmed and verified entry", now, now);
      t1Rosters[c.teamId] = generateSquadRoster(c.id, entryId, c.region, 2009, i);
    }

    // Fixtures for Mumbai Super Cup (Completed Group, Semi-Finals, 3rd Place, and LIVE Grand Final)
    // Completed Group Match 1: RFYC 2 - 0 BFC
    insertFixture.run(
      "fix-mum-1", divU17Mumbai, 1, "Group A - Matchday 1", "group", null, null,
      "entry-team-rfyc", "entry-team-bfc", "2026-09-01T09:00:00Z", 1, "completed", "completed", 90,
      null, 0, 5400, 3, null, 2, 0, 0, 0, "p-club-rfyc-10", "Aarav Sharma", now, now
    );
    insertEvent.run("ev-mum-1", "fix-mum-1", "entry-team-rfyc", "goal", "Aarav Sharma", "p-club-rfyc-10", "Rohan Desai", "p-club-rfyc-7", "", 24, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-2", "fix-mum-1", "entry-team-rfyc", "goal", "Aarav Sharma", "p-club-rfyc-10", "", null, "", 68, "second_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-3", "fix-mum-1", "entry-team-bfc", "yellow_card", "Tejas Kumar", "p-club-bfc-8", "", null, "", 52, "second_half", "Tactical Foul", "demo@myfootball.in", now);

    // Completed Group Match 2: Minerva 3 - 1 Dempo
    insertFixture.run(
      "fix-mum-2", divU17Mumbai, 1, "Group B - Matchday 1", "group", null, null,
      "entry-team-minerva", "entry-team-dempo", "2026-09-01T10:30:00Z", 2, "completed", "completed", 90,
      null, 0, 5400, 2, null, 3, 1, 0, 0, "p-club-minerva-9", "Gurpreet Singh", now, now
    );
    insertEvent.run("ev-mum-4", "fix-mum-2", "entry-team-minerva", "goal", "Gurpreet Singh", "p-club-minerva-9", "Manpreet Sandhu", "p-club-minerva-11", "", 12, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-5", "fix-mum-2", "entry-team-minerva", "goal", "Gurpreet Singh", "p-club-minerva-9", "", null, "", 41, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-6", "fix-mum-2", "entry-team-dempo", "goal", "Ashley Coutinho", "p-club-dempo-7", "Keith D'Souza", "p-club-dempo-8", "", 55, "second_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-7", "fix-mum-2", "entry-team-minerva", "goal", "Manpreet Sandhu", "p-club-minerva-11", "Gurpreet Singh", "p-club-minerva-9", "", 82, "second_half", "", "demo@myfootball.in", now);

    // Completed Semi-Final 1: RFYC 2 - 1 Dempo
    insertFixture.run(
      "fix-mum-sf1", divU17Mumbai, 2, "Semi-Final 1", "knockout", "semi_final", 1,
      "entry-team-rfyc", "entry-team-dempo", "2026-09-04T09:00:00Z", 1, "completed", "completed", 90,
      null, 0, 5400, 4, null, 2, 1, 0, 0, "p-club-rfyc-7", "Rohan Desai", now, now
    );
    insertEvent.run("ev-mum-8", "fix-mum-sf1", "entry-team-rfyc", "goal", "Rohan Desai", "p-club-rfyc-7", "Aarav Sharma", "p-club-rfyc-10", "", 18, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-9", "fix-mum-sf1", "entry-team-dempo", "goal", "Ashley Coutinho", "p-club-dempo-7", "", null, "", 60, "second_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-10", "fix-mum-sf1", "entry-team-rfyc", "goal", "Aarav Sharma", "p-club-rfyc-10", "Rohan Desai", "p-club-rfyc-7", "", 88, "second_half", "", "demo@myfootball.in", now);

    // Completed Semi-Final 2: Minerva 1 - 1 BFC (Shootout 4 - 3)
    insertFixture.run(
      "fix-mum-sf2", divU17Mumbai, 2, "Semi-Final 2", "knockout", "semi_final", 2,
      "entry-team-minerva", "entry-team-bfc", "2026-09-04T11:00:00Z", 1, "completed", "completed", 90,
      null, 0, 5400, 2, null, 1, 1, 4, 3, "p-club-minerva-1", "Jaswinder Gill", now, now
    );
    insertEvent.run("ev-mum-11", "fix-mum-sf2", "entry-team-bfc", "goal", "Nikhil Gowda", "p-club-bfc-10", "", null, "", 33, "first_half", "", "demo@myfootball.in", now);
    insertEvent.run("ev-mum-12", "fix-mum-sf2", "entry-team-minerva", "goal", "Gurpreet Singh", "p-club-minerva-9", "Manpreet Sandhu", "p-club-minerva-11", "", 77, "second_half", "", "demo@myfootball.in", now);
    for (let s = 1; s <= 5; s++) {
      insertShootout.run(`pen-min-${s}`, "fix-mum-sf2", "entry-team-minerva", `p-club-minerva-${s}`, s * 2 - 1, s !== 3 ? 1 : 0, "referee@myfootball.in", now);
      insertShootout.run(`pen-bfc-${s}`, "fix-mum-sf2", "entry-team-bfc", `p-club-bfc-${s}`, s * 2, s <= 3 ? 1 : 0, "referee@myfootball.in", now);
    }

    // Scheduled 3rd Place Playoff: Dempo vs BFC
    insertFixture.run(
      "fix-mum-bronze", divU17Mumbai, 3, "3rd Place Playoff", "knockout", "third_place", 1,
      "entry-team-dempo", "entry-team-bfc", "2026-09-05T14:00:00Z", 1, "scheduled", "scheduled", 0,
      null, 0, 0, 0, null, 0, 0, 0, 0, null, "", now, now
    );

    // SIMULTANEOUS LIVE MATCH 1: Mumbai Super Cup Grand Final (Pitch 1, 38th min, running clock!)
    const elapsed1 = 38 * 60 + 15;
    const clockStart1 = new Date(Date.now() - 15000).toISOString();
    insertFixture.run(
      "fix-mum-final", divU17Mumbai, 3, "Grand Final", "knockout", "final", 1,
      "entry-team-rfyc", "entry-team-minerva", "2026-09-05T16:30:00Z", 1, "in_progress", "first_half", 38,
      clockStart1, 1, elapsed1, 3, null, 1, 0, 0, 0, null, "", now, now
    );
    insertEvent.run("ev-mum-13", "fix-mum-final", "entry-team-rfyc", "goal", "Aarav Sharma", "p-club-rfyc-10", "Rohan Desai", "p-club-rfyc-7", "", 19, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-mum-14", "fix-mum-final", "entry-team-minerva", "yellow_card", "Harjot Bains", "p-club-minerva-5", "", null, "", 31, "first_half", "Tactical Foul", "referee@myfootball.in", now);

    insertAnnouncement.run(
      "ann-mum-1", t1Id, "organizer@myfootball.in",
      "Grand Final is LIVE on Pitch 1! RFYC U17 leads 1-0 against Minerva Punjab in the 38th minute.",
      "all_participants", now
    );


    // =========================================================================
    // 6. TOURNAMENT 2: Kolkata Youth IFA Championship 2026 (Live, Salt Lake Stadium)
    // =========================================================================
    const t2Id = "tourney-kolkata-ifa-2026";
    insertTournament.run(
      t2Id, "organizer@myfootball.in", "Kolkata Youth IFA Championship 2026", "Indian Football Association (IFA)",
      "Kolkata", "Salt Lake Stadium (VYBK) Practice Ground", "Sector III, Bidhannagar", "Salt Lake", "West Bengal",
      "700098", "22.569700", "88.406900", "2026-09-02", 12, "live", "11v11", 90,
      "Anirban Mukherjee", "+91 98300 54321", now, now
    );

    const divU19Kolkata = `${t2Id}-u19`;
    insertDivision.run(
      divU19Kolkata, t2Id, "Under-19 Elite Youth Cup", "2007-01-01", "11v11", "group_knockout",
      18, 8, 2, 2, 400000, "per_team", 1, 0, 3, 1, 0, 90, 15, 10, 0, now
    );

    const t2Clubs = [
      { id: "club-mbsg", teamId: "team-mbsg", name: "Mohun Bagan Super Giant Youth", teamName: "Mariners U19", city: "Kolkata", group: "Group A", seed: 1, region: "east", owner: "coach@myfootball.in" },
      { id: "club-ebfc-u19", teamId: "team-ebfc-u19", name: "East Bengal FC Colts", teamName: "Red & Gold Colts", city: "Kolkata", group: "Group A", seed: 2, region: "east", owner: "demo@myfootball.in" },
      { id: "club-mdsc", teamId: "team-mdsc", name: "Mohammedan SC Youth", teamName: "Black Panthers U19", city: "Kolkata", group: "Group B", seed: 1, region: "east", owner: "demo@myfootball.in" },
      { id: "club-unitedsc", teamId: "team-unitedsc", name: "United SC Academy", teamName: "Purple Brigade U19", city: "Kolkata", group: "Group B", seed: 2, region: "east", owner: "demo@myfootball.in" },
      { id: "club-ssamity", teamId: "team-ssamity", name: "Southern Samity Academy", teamName: "Southern Samity U19", city: "Kolkata", group: "Group A", seed: 3, region: "east", owner: "demo@myfootball.in" },
      { id: "club-peerless", teamId: "team-peerless", name: "Peerless SC Juniors", teamName: "Peerless Blue U19", city: "Kolkata", group: "Group B", seed: 3, region: "east", owner: "demo@myfootball.in" },
      { id: "club-kalighat", teamId: "team-kalighat", name: "Kalighat Milan Sangha", teamName: "Kalighat Warriors", city: "Kolkata", group: "Group A", seed: 4, region: "east", owner: "demo@myfootball.in" },
      { id: "club-aryan", teamId: "team-aryan", name: "Aryan Club Youth", teamName: "Aryan Knights U19", city: "Kolkata", group: "Group B", seed: 4, region: "east", owner: "demo@myfootball.in" },
    ];

    for (let i = 0; i < t2Clubs.length; i++) {
      const c = t2Clubs[i];
      insertClub.run(c.id, c.owner, c.name, "academy", c.city, "Head Coach", "+91 98000 00000", now);
      insertTeam.run(c.teamId, c.id, c.teamName, now);
      const entryId = `entry-${c.teamId}`;
      insertEntry.run(entryId, divU19Kolkata, c.teamId, "approved", "paid", 400000, c.seed, c.group, "Confirmed entry", now, now);
      generateSquadRoster(c.id, entryId, c.region, 2007, i + 10);
    }

    // Completed Group Matches in Kolkata
    insertFixture.run(
      "fix-kol-1", divU19Kolkata, 1, "Group A - Matchday 1", "group", null, null,
      "entry-team-mbsg", "entry-team-ssamity", "2026-09-02T09:00:00Z", 1, "completed", "completed", 90,
      null, 0, 5400, 2, null, 3, 0, 0, 0, "p-club-mbsg-9", "Rahim Ali", now, now
    );
    insertEvent.run("ev-kol-1", "fix-kol-1", "entry-team-mbsg", "goal", "Rahim Ali", "p-club-mbsg-9", "Pritam Kotal", "p-club-mbsg-2", "", 15, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-kol-2", "fix-kol-1", "entry-team-mbsg", "goal", "Rahim Ali", "p-club-mbsg-9", "", null, "", 58, "second_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-kol-3", "fix-kol-1", "entry-team-mbsg", "goal", "Subhashis Bose", "p-club-mbsg-4", "", null, "", 81, "second_half", "", "referee@myfootball.in", now);

    insertFixture.run(
      "fix-kol-2", divU19Kolkata, 1, "Group B - Matchday 1", "group", null, null,
      "entry-team-mdsc", "entry-team-peerless", "2026-09-02T11:00:00Z", 2, "completed", "completed", 90,
      null, 0, 5400, 3, null, 2, 1, 0, 0, "p-club-mdsc-10", "Mehtab Ali", now, now
    );
    insertEvent.run("ev-kol-4", "fix-kol-2", "entry-team-mdsc", "goal", "Mehtab Ali", "p-club-mdsc-10", "", null, "", 29, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-kol-5", "fix-kol-2", "entry-team-peerless", "goal", "Surajit Das", "p-club-peerless-9", "", null, "", 48, "second_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-kol-6", "fix-kol-2", "entry-team-mdsc", "goal", "Debjit Majumder", "p-club-mdsc-7", "", null, "", 74, "second_half", "", "referee@myfootball.in", now);

    // SIMULTANEOUS LIVE MATCH 2: Kolkata Derby (Pitch 1, 64th min, 2nd half, clock running!)
    const elapsed2 = 64 * 60 + 20;
    const clockStart2 = new Date(Date.now() - 20000).toISOString();
    insertFixture.run(
      "fix-kol-live1", divU19Kolkata, 2, "Group A - The Kolkata Derby", "group", null, null,
      "entry-team-mbsg", "entry-team-ebfc-u19", "2026-09-03T14:00:00Z", 1, "in_progress", "second_half", 64,
      clockStart2, 1, elapsed2, 4, null, 2, 1, 0, 0, null, "", now, now
    );
    insertEvent.run("ev-kol-7", "fix-kol-live1", "entry-team-mbsg", "goal", "Subhashis Bose", "p-club-mbsg-4", "Pritam Kotal", "p-club-mbsg-2", "", 22, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-kol-8", "fix-kol-live1", "entry-team-mbsg", "goal", "Rahim Ali", "p-club-mbsg-9", "", null, "", 44, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-kol-9", "fix-kol-live1", "entry-team-ebfc-u19", "goal", "Sayan Banerjee", "p-club-ebfc-u19-11", "", null, "", 58, "second_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-kol-10", "fix-kol-live1", "entry-team-ebfc-u19", "yellow_card", "Tanmay Das", "p-club-ebfc-u19-6", "", null, "", 39, "first_half", "Reckless Tackle", "referee@myfootball.in", now);

    // SIMULTANEOUS LIVE MATCH 3: Mohammedan vs United SC (Pitch 2 in Kolkata concurrently running!)
    const elapsed3 = 32 * 60 + 45;
    const clockStart3 = new Date(Date.now() - 45000).toISOString();
    insertFixture.run(
      "fix-kol-live2", divU19Kolkata, 2, "Group B - Matchday 2", "group", null, null,
      "entry-team-mdsc", "entry-team-unitedsc", "2026-09-03T14:00:00Z", 2, "in_progress", "first_half", 32,
      clockStart3, 1, elapsed3, 2, null, 0, 0, 0, 0, null, "", now, now
    );
    insertEvent.run("ev-kol-11", "fix-kol-live2", "entry-team-mdsc", "yellow_card", "Mehtab Ali", "p-club-mdsc-10", "", null, "", 25, "first_half", "Dissent", "referee@myfootball.in", now);

    // Scheduled upcoming matches in Kolkata
    insertFixture.run(
      "fix-kol-sch1", divU19Kolkata, 3, "Group A - Matchday 3", "group", null, null,
      "entry-team-ssamity", "entry-team-kalighat", "2026-09-04T09:00:00Z", 1, "scheduled", "scheduled", 0,
      null, 0, 0, 0, null, 0, 0, 0, 0, null, "", now, now
    );
    insertFixture.run(
      "fix-kol-sch2", divU19Kolkata, 3, "Group B - Matchday 3", "group", null, null,
      "entry-team-peerless", "entry-team-aryan", "2026-09-04T11:00:00Z", 2, "scheduled", "scheduled", 0,
      null, 0, 0, 0, null, 0, 0, 0, 0, null, "", now, now
    );


    // =========================================================================
    // 7. TOURNAMENT 3: Kerala State Youth Super League 2026 (Live, EMS Stadium)
    // =========================================================================
    const t3Id = "tourney-kerala-youth-2026";
    insertTournament.run(
      t3Id, "organizer@myfootball.in", "Kerala State Youth Super League 2026", "Kerala Football Association",
      "Kozhikode", "EMS Corporation Stadium", "Stadium Road, Mavoor Road", "Mavoor Road", "Kerala",
      "673004", "11.258800", "75.780400", "2026-09-03", 10, "live", "11v11", 90,
      "K. T. Shaji", "+91 98460 98765", now, now
    );

    const divU15Kerala = `${t3Id}-u15`;
    insertDivision.run(
      divU15Kerala, t3Id, "Under-15 Malabar Champions Cup", "2011-01-01", "11v11", "group_knockout",
      18, 8, 2, 2, 250000, "per_team", 1, 0, 3, 1, 0, 90, 15, 10, 0, now
    );

    const t3Clubs = [
      { id: "club-gokulam-u15", teamId: "team-gokulam-u15", name: "Gokulam Kerala Academy", teamName: "Malabar Tigers U15", city: "Kozhikode", group: "Group A", seed: 1, region: "south", owner: "coach@myfootball.in" },
      { id: "club-kbfcy", teamId: "team-kbfcy", name: "Kerala Blasters Youth", teamName: "Yellow Brigade U15", city: "Kochi", group: "Group A", seed: 2, region: "south", owner: "demo@myfootball.in" },
      { id: "club-muthoot", teamId: "team-muthoot", name: "Muthoot Football Academy", teamName: "Muthoot FA U15", city: "Kochi", group: "Group A", seed: 3, region: "south", owner: "demo@myfootball.in" },
      { id: "club-parappur", teamId: "team-parappur", name: "Parappur FC Academy", teamName: "Parappur Strikers", city: "Thrissur", group: "Group A", seed: 4, region: "south", owner: "demo@myfootball.in" },
      { id: "club-goldenthreads", teamId: "team-goldenthreads", name: "Golden Threads FC", teamName: "Golden Threads U15", city: "Kochi", group: "Group B", seed: 1, region: "south", owner: "demo@myfootball.in" },
      { id: "club-wayanad", teamId: "team-wayanad", name: "Wayanad United Academy", teamName: "Wayanad Hills FC", city: "Kalpetta", group: "Group B", seed: 2, region: "south", owner: "demo@myfootball.in" },
      { id: "club-areekode", teamId: "team-areekode", name: "FC Areekode Academy", teamName: "Areekode Warriors", city: "Malappuram", group: "Group B", seed: 3, region: "south", owner: "demo@myfootball.in" },
      { id: "club-kovalam", teamId: "team-kovalam", name: "Kovalam FC Colts", teamName: "Kovalam Surfers", city: "Thiruvananthapuram", group: "Group B", seed: 4, region: "south", owner: "demo@myfootball.in" },
    ];

    for (let i = 0; i < t3Clubs.length; i++) {
      const c = t3Clubs[i];
      insertClub.run(c.id, c.owner, c.name, "academy", c.city, "Head Coach", "+91 98000 00000", now);
      insertTeam.run(c.teamId, c.id, c.teamName, now);
      const entryId = `entry-${c.teamId}`;
      insertEntry.run(entryId, divU15Kerala, c.teamId, "approved", "paid", 250000, c.seed, c.group, "Confirmed entry", now, now);
      generateSquadRoster(c.id, entryId, c.region, 2011, i + 20);
    }

    // Completed Group Matches in Kerala
    insertFixture.run(
      "fix-ker-1", divU15Kerala, 1, "Group A - Matchday 1", "group", null, null,
      "entry-team-muthoot", "entry-team-parappur", "2026-09-03T08:30:00Z", 1, "completed", "completed", 90,
      null, 0, 5400, 2, null, 2, 0, 0, 0, "p-club-muthoot-9", "Jithin MS", now, now
    );
    insertEvent.run("ev-ker-1", "fix-ker-1", "entry-team-muthoot", "goal", "Jithin MS", "p-club-muthoot-9", "Suhair VP", "p-club-muthoot-10", "", 35, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-ker-2", "fix-ker-1", "entry-team-muthoot", "goal", "Jithin MS", "p-club-muthoot-9", "", null, "", 72, "second_half", "", "referee@myfootball.in", now);

    insertFixture.run(
      "fix-ker-2", divU15Kerala, 1, "Group B - Matchday 1", "group", null, null,
      "entry-team-goldenthreads", "entry-team-wayanad", "2026-09-03T10:30:00Z", 2, "completed", "completed", 90,
      null, 0, 5400, 1, null, 1, 0, 0, 0, "p-club-goldenthreads-10", "Vibin Mohanan", now, now
    );
    insertEvent.run("ev-ker-3", "fix-ker-2", "entry-team-goldenthreads", "goal", "Vibin Mohanan", "p-club-goldenthreads-10", "", null, "", 53, "second_half", "", "referee@myfootball.in", now);

    // SIMULTANEOUS LIVE MATCH 4: Malabar Youth Derby (Pitch 1, 42nd min, 1st half, clock running!)
    const elapsed4 = 42 * 60 + 10;
    const clockStart4 = new Date(Date.now() - 10000).toISOString();
    insertFixture.run(
      "fix-ker-live1", divU15Kerala, 2, "Group A - Malabar Youth Derby", "group", null, null,
      "entry-team-gokulam-u15", "entry-team-kbfcy", "2026-09-03T15:00:00Z", 1, "in_progress", "first_half", 42,
      clockStart4, 1, elapsed4, 3, null, 1, 1, 0, 0, null, "", now, now
    );
    insertEvent.run("ev-ker-4", "fix-ker-live1", "entry-team-gokulam-u15", "goal", "Ashique Kuruniyan", "p-club-gokulam-u15-11", "Rahul KP", "p-club-gokulam-u15-7", "", 14, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-ker-5", "fix-ker-live1", "entry-team-kbfcy", "goal", "Mohammed Aimen", "p-club-kbfcy-9", "Nihal Sudeesh", "p-club-kbfcy-10", "", 38, "first_half", "", "referee@myfootball.in", now);
    insertEvent.run("ev-ker-6", "fix-ker-live1", "entry-team-kbfcy", "yellow_card", "Bijoy Varghese", "p-club-kbfcy-3", "", null, "", 29, "first_half", "Tripping", "referee@myfootball.in", now);

    // Scheduled upcoming matches in Kerala
    insertFixture.run(
      "fix-ker-sch1", divU15Kerala, 2, "Group B - Matchday 2", "group", null, null,
      "entry-team-areekode", "entry-team-kovalam", "2026-09-04T09:00:00Z", 1, "scheduled", "scheduled", 0,
      null, 0, 0, 0, null, 0, 0, 0, 0, null, "", now, now
    );


    // =========================================================================
    // 8. TOURNAMENT 4: Goa Pro-Youth Golden Trophy 2026 (Scheduled, Duler Stadium)
    // =========================================================================
    const t4Id = "tourney-goa-golden-2026";
    insertTournament.run(
      t4Id, "organizer@myfootball.in", "Goa Pro-Youth Golden Trophy 2026", "Goa Football Association",
      "Mapusa", "Duler Football Stadium", "Duler Football Complex, Mapusa-Duler Road", "Duler", "Goa",
      "403507", "15.593700", "73.814200", "2026-09-12", 8, "scheduled", "11v11", 90,
      "Savio Medeira", "+91 98221 67890", now, now
    );

    const divU17Goa = `${t4Id}-u17`;
    insertDivision.run(
      divU17Goa, t4Id, "Under-17 Golden Division", "2009-01-01", "11v11", "group_knockout",
      18, 8, 2, 2, 300000, "per_team", 1, 0, 3, 1, 0, 90, 15, 10, 0, now
    );

    const t4Clubs = [
      { id: "club-dempo-goa", teamId: "team-dempo-goa", name: "Dempo SC Juniors", teamName: "Golden Eagles U17", city: "Panaji", group: "Group A", seed: 1, region: "goa", owner: "coach@myfootball.in" },
      { id: "club-churchill", teamId: "team-churchill", name: "Churchill Brothers Youth", teamName: "Red Machines U17", city: "Margao", group: "Group A", seed: 2, region: "goa", owner: "demo@myfootball.in" },
      { id: "club-salgaocar", teamId: "team-salgaocar", name: "Salgaocar FC Colts", teamName: "Green Brigade U17", city: "Vasco", group: "Group A", seed: 3, region: "goa", owner: "demo@myfootball.in" },
      { id: "club-sportinggoa", teamId: "team-sportinggoa", name: "Sporting Clube de Goa Youth", teamName: "Flaming Oranje U17", city: "Panaji", group: "Group A", seed: 4, region: "goa", owner: "demo@myfootball.in" },
      { id: "club-fcgoa-dev", teamId: "team-fcgoa-dev", name: "FC Goa Dev Team", teamName: "Gaurs Colts U17", city: "Margao", group: "Group B", seed: 1, region: "goa", owner: "demo@myfootball.in" },
      { id: "club-sesa", teamId: "team-sesa", name: "SESA Football Academy", teamName: "SESA Academy U17", city: "Sanquelim", group: "Group B", seed: 2, region: "goa", owner: "demo@myfootball.in" },
      { id: "club-velsao", teamId: "team-velsao", name: "Velsao SCC Youth", teamName: "Velsao Coastal U17", city: "Velsao", group: "Group B", seed: 3, region: "goa", owner: "demo@myfootball.in" },
      { id: "club-vasco", teamId: "team-vasco", name: "Vasco SC Juniors", teamName: "Port Town Sailors U17", city: "Vasco", group: "Group B", seed: 4, region: "goa", owner: "demo@myfootball.in" },
    ];

    for (let i = 0; i < t4Clubs.length; i++) {
      const c = t4Clubs[i];
      insertClub.run(c.id, c.owner, c.name, "academy", c.city, "Head Coach", "+91 98000 00000", now);
      insertTeam.run(c.teamId, c.id, c.teamName, now);
      const entryId = `entry-${c.teamId}`;
      insertEntry.run(entryId, divU17Goa, c.teamId, "approved", "paid", 300000, c.seed, c.group, "Confirmed entry", now, now);
      generateSquadRoster(c.id, entryId, c.region, 2009, i + 30);
    }

    // Complete Scheduled Fixtures for Goa (All 12 round-robin group matches scheduled across Pitches 1 & 2)
    const goaFixtures = [
      { id: "fix-goa-1", round: "Group A - Matchday 1", h: "entry-team-dempo-goa", a: "entry-team-churchill", time: "2026-09-12T09:00:00Z", pitch: 1 },
      { id: "fix-goa-2", round: "Group A - Matchday 1", h: "entry-team-salgaocar", a: "entry-team-sportinggoa", time: "2026-09-12T11:00:00Z", pitch: 2 },
      { id: "fix-goa-3", round: "Group B - Matchday 1", h: "entry-team-fcgoa-dev", a: "entry-team-sesa", time: "2026-09-12T14:00:00Z", pitch: 1 },
      { id: "fix-goa-4", round: "Group B - Matchday 1", h: "entry-team-velsao", a: "entry-team-vasco", time: "2026-09-12T16:00:00Z", pitch: 2 },
      { id: "fix-goa-5", round: "Group A - Matchday 2", h: "entry-team-dempo-goa", a: "entry-team-salgaocar", time: "2026-09-14T09:00:00Z", pitch: 1 },
      { id: "fix-goa-6", round: "Group A - Matchday 2", h: "entry-team-churchill", a: "entry-team-sportinggoa", time: "2026-09-14T11:00:00Z", pitch: 2 },
      { id: "fix-goa-7", round: "Group B - Matchday 2", h: "entry-team-fcgoa-dev", a: "entry-team-velsao", time: "2026-09-14T14:00:00Z", pitch: 1 },
      { id: "fix-goa-8", round: "Group B - Matchday 2", h: "entry-team-sesa", a: "entry-team-vasco", time: "2026-09-14T16:00:00Z", pitch: 2 },
      { id: "fix-goa-9", round: "Group A - Matchday 3", h: "entry-team-dempo-goa", a: "entry-team-sportinggoa", time: "2026-09-16T09:00:00Z", pitch: 1 },
      { id: "fix-goa-10", round: "Group A - Matchday 3", h: "entry-team-churchill", a: "entry-team-salgaocar", time: "2026-09-16T11:00:00Z", pitch: 2 },
      { id: "fix-goa-11", round: "Group B - Matchday 3", h: "entry-team-fcgoa-dev", a: "entry-team-vasco", time: "2026-09-16T14:00:00Z", pitch: 1 },
      { id: "fix-goa-12", round: "Group B - Matchday 3", h: "entry-team-sesa", a: "entry-team-velsao", time: "2026-09-16T16:00:00Z", pitch: 2 },
    ];
    for (let i = 0; i < goaFixtures.length; i++) {
      const gf = goaFixtures[i];
      insertFixture.run(
        gf.id, divU17Goa, Math.floor(i / 4) + 1, gf.round, "group", null, null,
        gf.h, gf.a, gf.time, gf.pitch, "scheduled", "scheduled", 0,
        null, 0, 0, 0, null, 0, 0, 0, 0, null, "", now, now
      );
    }

    insertAnnouncement.run(
      "ann-goa-1", t4Id, "organizer@myfootball.in",
      "Official draw completed! All 12 round-robin group fixtures published across Pitch 1 and Pitch 2 at Duler Football Stadium.",
      "all_participants", now
    );

    // Follows
    insertFollow.run("fan@myfootball.in", t1Id, now);
    insertFollow.run("fan@myfootball.in", t2Id, now);
    insertFollow.run("coach@myfootball.in", t1Id, now);
    insertFollow.run("coach@myfootball.in", t2Id, now);
    insertFollow.run("coach@myfootball.in", t3Id, now);
    insertFollow.run("coach@myfootball.in", t4Id, now);

    // Audit entries
    insertAudit.run("aud-1", t1Id, "organizer@myfootball.in", "TOURNAMENT_PUBLISHED", "tournament", t1Id, "Mumbai Super Cup 2026 published with 8 verified academies.", now);
    insertAudit.run("aud-2", t2Id, "organizer@myfootball.in", "TOURNAMENT_PUBLISHED", "tournament", t2Id, "Kolkata Youth IFA Championship published with 8 verified academies.", now);
    insertAudit.run("aud-3", t3Id, "organizer@myfootball.in", "TOURNAMENT_PUBLISHED", "tournament", t3Id, "Kerala State Youth Super League published with 8 verified academies.", now);
    insertAudit.run("aud-4", t4Id, "organizer@myfootball.in", "TOURNAMENT_PUBLISHED", "tournament", t4Id, "Goa Pro-Youth Golden Trophy published with 8 verified academies.", now);

    console.log("Seeding finished successfully with rich football ecosystem (32 teams, 576 players, 4 live matches, 8 completed, 24 scheduled)!");
  }
}
