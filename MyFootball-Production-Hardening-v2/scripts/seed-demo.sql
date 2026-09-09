-- MyFootball India - Stakeholder Demo Seed Data
-- Populates: Mumbai Super Cup 2026 (live tournament) with 8 teams,
-- completed group & knockout matches, an ongoing grand final, players, squads & announcements.
-- Run: npx wrangler d1 execute myfootball-db --remote --file=./scripts/seed-demo.sql

-- ── 1. Users ─────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (email, full_name, role, preferred_state, preferred_city, created_at, updated_at) VALUES
  ('organizer@myfootball.in', 'Vikramaditya Singhania', 'organizer', 'Maharashtra', 'Mumbai', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('coach@myfootball.in',     'Coach Subrata Paul',    'coach',     'Maharashtra', 'Mumbai', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('referee@myfootball.in',   'Michael Murmu (AIFF)',  'referee',   'Maharashtra', 'Mumbai', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('fan@myfootball.in',       'Aarav Sharma',          'fan',       'Maharashtra', 'Mumbai', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('demo@myfootball.in',      'Demo Organizer',        'organizer', 'Maharashtra', 'Mumbai', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z');

-- ── 2. Tournament ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO tournaments
  (id, organizer_email, name, organized_by, city, venue_name, address_line_1, locality, state, postal_code, latitude, longitude, start_date, duration_days, status, contact_name, contact_phone, created_at, updated_at)
VALUES
  ('tourney-mumbai-super-cup-2026',
   'organizer@myfootball.in',
   'Mumbai Super Cup 2026',
   'Western India Football Association',
   'Mumbai',
   'Cooperage Football Ground',
   'Madame Cama Road, Colaba',
   'Colaba', 'Maharashtra', '400001',
   '18.924800', '72.828600',
   '2026-09-01', 5, 'live',
   'Sunil Fernandes', '+91 98200 12345',
   '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z');

-- ── 3. Division ───────────────────────────────────────────────────────────────
-- Note: groups_count and teams_advancing_per_group added in migration 0002
INSERT OR IGNORE INTO divisions
  (id, tournament_id, name, format, max_squad_size, max_teams, groups_count, teams_advancing_per_group, fee_paise, fee_basis, require_players, require_documents, win_points, draw_points, loss_points, created_at)
VALUES
  ('tourney-mumbai-super-cup-2026-u17',
   'tourney-mumbai-super-cup-2026',
   'Under-17 Premier Division',
   'group_knockout',
   18, 16, 2, 2,
   350000, 'per_team',
   1, 0,
   3, 1, 0,
   '2026-09-09T22:00:00.000Z');

-- ── 4. Clubs ──────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO clubs (id, owner_email, name, organization_type, city, contact_name, contact_phone, created_at) VALUES
  ('club-rfyc',      'coach@myfootball.in', 'Reliance Foundation Young Champs', 'academy', 'Navi Mumbai', 'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z'),
  ('club-minerva',   'demo@myfootball.in',  'Minerva Punjab Academy',           'academy', 'Mohali',      'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z'),
  ('club-bfc',       'demo@myfootball.in',  'Bengaluru FC Academy',             'academy', 'Bengaluru',   'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z'),
  ('club-dempo',     'demo@myfootball.in',  'Dempo SC Juniors',                 'academy', 'Panaji',      'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z'),
  ('club-mcfc',      'demo@myfootball.in',  'Mumbai City FC Youth',             'academy', 'Mumbai',      'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z'),
  ('club-sudeva',    'demo@myfootball.in',  'Sudeva Delhi FC',                  'academy', 'New Delhi',   'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z'),
  ('club-gokulam',   'demo@myfootball.in',  'Gokulam Kerala FC',                'academy', 'Kozhikode',   'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z'),
  ('club-eastbengal','demo@myfootball.in',  'East Bengal FC Academy',           'academy', 'Kolkata',     'Head Coach', '+91 98000 00000', '2026-09-09T22:00:00.000Z');

-- ── 5. Teams ──────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO teams (id, club_id, name, created_at) VALUES
  ('team-rfyc',       'club-rfyc',       'RFYC U17',            '2026-09-09T22:00:00.000Z'),
  ('team-minerva',    'club-minerva',    'Minerva Punjab U17',  '2026-09-09T22:00:00.000Z'),
  ('team-bfc',        'club-bfc',        'BFC Blues U17',       '2026-09-09T22:00:00.000Z'),
  ('team-dempo',      'club-dempo',      'Dempo Golden Eagles', '2026-09-09T22:00:00.000Z'),
  ('team-mcfc',       'club-mcfc',       'MCFC Islanders U17',  '2026-09-09T22:00:00.000Z'),
  ('team-sudeva',     'club-sudeva',     'Sudeva Delhi U17',    '2026-09-09T22:00:00.000Z'),
  ('team-gokulam',    'club-gokulam',    'Malabarians U17',     '2026-09-09T22:00:00.000Z'),
  ('team-eastbengal', 'club-eastbengal', 'Red & Gold Brigade',  '2026-09-09T22:00:00.000Z');

-- ── 6. Entries (group_name added in migration 0002) ───────────────────────────
INSERT OR IGNORE INTO entries (id, division_id, team_id, status, payment_status, amount_paise, seed, group_name, notes, registered_at, approved_at) VALUES
  ('entry-team-rfyc',       'tourney-mumbai-super-cup-2026-u17', 'team-rfyc',       'approved', 'paid', 350000, 1, 'Group A', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('entry-team-minerva',    'tourney-mumbai-super-cup-2026-u17', 'team-minerva',    'approved', 'paid', 350000, 1, 'Group B', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('entry-team-bfc',        'tourney-mumbai-super-cup-2026-u17', 'team-bfc',        'approved', 'paid', 350000, 2, 'Group A', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('entry-team-dempo',      'tourney-mumbai-super-cup-2026-u17', 'team-dempo',      'approved', 'paid', 350000, 2, 'Group B', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('entry-team-mcfc',       'tourney-mumbai-super-cup-2026-u17', 'team-mcfc',       'approved', 'paid', 350000, 3, 'Group A', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('entry-team-sudeva',     'tourney-mumbai-super-cup-2026-u17', 'team-sudeva',     'approved', 'paid', 350000, 3, 'Group B', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('entry-team-gokulam',    'tourney-mumbai-super-cup-2026-u17', 'team-gokulam',    'approved', 'paid', 350000, 4, 'Group A', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  ('entry-team-eastbengal', 'tourney-mumbai-super-cup-2026-u17', 'team-eastbengal', 'approved', 'paid', 350000, 4, 'Group B', 'Confirmed entry', '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z');

-- ── 7. Players ────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO players (id, club_id, name, date_of_birth, jersey_number, position, is_captain, created_at) VALUES
  -- RFYC
  ('p-rf-1',  'club-rfyc',    'Aarav Sharma',     '2009-04-12', 10, 'FWD', 1, '2026-09-09T22:00:00.000Z'),
  ('p-rf-2',  'club-rfyc',    'Rohan Desai',      '2009-08-20',  7, 'MID', 0, '2026-09-09T22:00:00.000Z'),
  ('p-rf-3',  'club-rfyc',    'Harsh Patel',      '2009-02-15',  1, 'GK',  0, '2026-09-09T22:00:00.000Z'),
  ('p-rf-4',  'club-rfyc',    'Siddharth Rao',    '2009-06-30',  4, 'DEF', 0, '2026-09-09T22:00:00.000Z'),
  ('p-rf-5',  'club-rfyc',    'Vikrant Kulkarni', '2009-11-05',  9, 'FWD', 0, '2026-09-09T22:00:00.000Z'),
  -- Minerva Punjab
  ('p-min-1', 'club-minerva', 'Gurpreet Singh',   '2009-01-22',  9, 'FWD', 1, '2026-09-09T22:00:00.000Z'),
  ('p-min-2', 'club-minerva', 'Manpreet Sandhu',  '2009-05-14', 11, 'MID', 0, '2026-09-09T22:00:00.000Z'),
  ('p-min-3', 'club-minerva', 'Jaswinder Gill',   '2009-09-10',  1, 'GK',  0, '2026-09-09T22:00:00.000Z'),
  ('p-min-4', 'club-minerva', 'Harjot Bains',     '2009-07-04',  5, 'DEF', 0, '2026-09-09T22:00:00.000Z'),
  -- Bengaluru FC
  ('p-bfc-1', 'club-bfc',     'Nikhil Gowda',     '2009-03-25', 10, 'FWD', 1, '2026-09-09T22:00:00.000Z'),
  ('p-bfc-2', 'club-bfc',     'Srikant Reddy',    '2009-06-11',  1, 'GK',  0, '2026-09-09T22:00:00.000Z'),
  ('p-bfc-3', 'club-bfc',     'Tejas Kumar',      '2009-10-02',  8, 'MID', 0, '2026-09-09T22:00:00.000Z'),
  -- Dempo
  ('p-dmp-1', 'club-dempo',   'Ashley Coutinho',  '2009-05-09',  7, 'FWD', 1, '2026-09-09T22:00:00.000Z'),
  ('p-dmp-2', 'club-dempo',   'Shawn Fernandes',  '2009-07-22',  1, 'GK',  0, '2026-09-09T22:00:00.000Z'),
  ('p-dmp-3', 'club-dempo',   'Keith D''Souza',   '2009-11-14',  8, 'MID', 0, '2026-09-09T22:00:00.000Z');

-- ── 8. Squad Members ──────────────────────────────────────────────────────────
INSERT OR IGNORE INTO squad_members (id, entry_id, player_id, is_starting, registered_at) VALUES
  ('sm-p-rf-1',  'entry-team-rfyc',    'p-rf-1',  1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-rf-2',  'entry-team-rfyc',    'p-rf-2',  1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-rf-3',  'entry-team-rfyc',    'p-rf-3',  1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-rf-4',  'entry-team-rfyc',    'p-rf-4',  1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-rf-5',  'entry-team-rfyc',    'p-rf-5',  0, '2026-09-09T22:00:00.000Z'),
  ('sm-p-min-1', 'entry-team-minerva', 'p-min-1', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-min-2', 'entry-team-minerva', 'p-min-2', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-min-3', 'entry-team-minerva', 'p-min-3', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-min-4', 'entry-team-minerva', 'p-min-4', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-bfc-1', 'entry-team-bfc',     'p-bfc-1', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-bfc-2', 'entry-team-bfc',     'p-bfc-2', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-bfc-3', 'entry-team-bfc',     'p-bfc-3', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-dmp-1', 'entry-team-dempo',   'p-dmp-1', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-dmp-2', 'entry-team-dempo',   'p-dmp-2', 1, '2026-09-09T22:00:00.000Z'),
  ('sm-p-dmp-3', 'entry-team-dempo',   'p-dmp-3', 1, '2026-09-09T22:00:00.000Z');

-- ── 9. Fixtures ───────────────────────────────────────────────────────────────
-- Columns from migrations 0000 + 0002 additions
INSERT OR IGNORE INTO fixtures
  (id, division_id, round_number, round_name, stage, bracket_round, bracket_match_index,
   home_entry_id, away_entry_id, kickoff_at, pitch, status, period, match_clock_minute,
   home_score, away_score, home_score_penalties, away_score_penalties,
   potm_player_id, potm_player_name, published_at, created_at)
VALUES
  -- Group A Matchday 1: RFYC 2-0 BFC (completed)
  ('fix-grp-1', 'tourney-mumbai-super-cup-2026-u17', 1, 'Group A - Matchday 1', 'group', NULL, NULL,
   'entry-team-rfyc', 'entry-team-bfc', '2026-09-01T09:00:00Z', 1,
   'completed', 'completed', 90, 2, 0, 0, 0, 'p-rf-1', 'Aarav Sharma',
   '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  -- Group B Matchday 1: Minerva 3-1 Dempo (completed)
  ('fix-grp-2', 'tourney-mumbai-super-cup-2026-u17', 1, 'Group B - Matchday 1', 'group', NULL, NULL,
   'entry-team-minerva', 'entry-team-dempo', '2026-09-01T10:30:00Z', 2,
   'completed', 'completed', 90, 3, 1, 0, 0, 'p-min-1', 'Gurpreet Singh',
   '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  -- Semi-Final 1: RFYC 2-1 Dempo (completed)
  ('fix-sf-1', 'tourney-mumbai-super-cup-2026-u17', 2, 'Semi-Final 1', 'knockout', 'semi_final', 1,
   'entry-team-rfyc', 'entry-team-dempo', '2026-09-04T09:00:00Z', 1,
   'completed', 'completed', 90, 2, 1, 0, 0, 'p-rf-2', 'Rohan Desai',
   '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  -- Semi-Final 2: Minerva 1-1 BFC (4-3 on penalties, completed)
  ('fix-sf-2', 'tourney-mumbai-super-cup-2026-u17', 2, 'Semi-Final 2', 'knockout', 'semi_final', 2,
   'entry-team-minerva', 'entry-team-bfc', '2026-09-04T11:00:00Z', 1,
   'completed', 'completed', 90, 1, 1, 4, 3, 'p-min-3', 'Jaswinder Gill',
   '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  -- 3rd Place Playoff: Dempo vs BFC (scheduled)
  ('fix-bronze', 'tourney-mumbai-super-cup-2026-u17', 3, '3rd Place Playoff', 'knockout', 'third_place', 1,
   'entry-team-dempo', 'entry-team-bfc', '2026-09-05T14:00:00Z', 1,
   'scheduled', 'scheduled', 0, 0, 0, 0, 0, NULL, '',
   '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z'),
  -- Grand Final: RFYC vs Minerva 1-0 (LIVE — 36'' first half)
  ('fix-final', 'tourney-mumbai-super-cup-2026-u17', 3, 'Grand Final', 'knockout', 'final', 1,
   'entry-team-rfyc', 'entry-team-minerva', '2026-09-05T16:30:00Z', 1,
   'in_progress', 'first_half', 36, 1, 0, 0, 0, NULL, '',
   '2026-09-09T22:00:00.000Z', '2026-09-09T22:00:00.000Z');

-- ── 10. Match Events ──────────────────────────────────────────────────────────
-- Columns from migrations 0000 + 0002 additions
INSERT OR IGNORE INTO match_events
  (id, fixture_id, entry_id, type, player_name, player_id, assist_player_name, assist_player_id,
   related_player_name, match_minute, match_period, card_reason, recorded_by, created_at)
VALUES
  -- fix-grp-1 events
  ('ev-1',  'fix-grp-1', 'entry-team-rfyc',    'goal',        'Aarav Sharma',   'p-rf-1',  'Rohan Desai',     'p-rf-2',  '', 24, 'first_half',  '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-2',  'fix-grp-1', 'entry-team-rfyc',    'goal',        'Aarav Sharma',   'p-rf-1',  '',                 NULL,      '', 68, 'second_half', '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-3',  'fix-grp-1', 'entry-team-bfc',     'yellow_card', 'Tejas Kumar',    'p-bfc-3', '',                 NULL,      '', 52, 'second_half', 'Tactical Foul',  'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  -- fix-grp-2 events
  ('ev-4',  'fix-grp-2', 'entry-team-minerva', 'goal',        'Gurpreet Singh', 'p-min-1', 'Manpreet Sandhu', 'p-min-2', '', 12, 'first_half',  '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-5',  'fix-grp-2', 'entry-team-minerva', 'goal',        'Gurpreet Singh', 'p-min-1', '',                 NULL,      '', 41, 'first_half',  '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-6',  'fix-grp-2', 'entry-team-dempo',   'goal',        'Ashley Coutinho','p-dmp-1', 'Keith D''Souza',  'p-dmp-3', '', 55, 'second_half', '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-7',  'fix-grp-2', 'entry-team-minerva', 'goal',        'Manpreet Sandhu','p-min-2', 'Gurpreet Singh',  'p-min-1', '', 82, 'second_half', '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  -- fix-sf-1 events
  ('ev-8',  'fix-sf-1',  'entry-team-rfyc',    'goal',        'Rohan Desai',    'p-rf-2',  'Aarav Sharma',    'p-rf-1',  '', 18, 'first_half',  '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-9',  'fix-sf-1',  'entry-team-dempo',   'goal',        'Ashley Coutinho','p-dmp-1', '',                 NULL,      '', 60, 'second_half', '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-10', 'fix-sf-1',  'entry-team-rfyc',    'goal',        'Aarav Sharma',   'p-rf-1',  'Rohan Desai',     'p-rf-2',  '', 88, 'second_half', '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  -- fix-sf-2 events
  ('ev-11', 'fix-sf-2',  'entry-team-bfc',     'goal',        'Nikhil Gowda',   'p-bfc-1', '',                 NULL,      '', 33, 'first_half',  '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-12', 'fix-sf-2',  'entry-team-minerva', 'goal',        'Gurpreet Singh', 'p-min-1', 'Manpreet Sandhu', 'p-min-2', '', 77, 'second_half', '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  -- Grand Final events (live)
  ('ev-13', 'fix-final', 'entry-team-rfyc',    'goal',        'Aarav Sharma',   'p-rf-1',  'Rohan Desai',     'p-rf-2',  '', 19, 'first_half',  '',               'demo@myfootball.in', '2026-09-09T22:00:00.000Z'),
  ('ev-14', 'fix-final', 'entry-team-minerva', 'yellow_card', 'Harjot Bains',   'p-min-4', '',                 NULL,      '', 31, 'first_half',  'Dissent',        'demo@myfootball.in', '2026-09-09T22:00:00.000Z');

-- ── 11. Announcements ─────────────────────────────────────────────────────────
INSERT OR IGNORE INTO announcements (id, tournament_id, sender_email, body, audience, created_at) VALUES
  ('ann-1', 'tourney-mumbai-super-cup-2026', 'demo@myfootball.in',
   'Welcome to the Mumbai Super Cup 2026! Grand Final between RFYC U17 and Minerva Punjab U17 is now underway on Pitch 1.',
   'all_participants', '2026-09-09T22:00:00.000Z');
