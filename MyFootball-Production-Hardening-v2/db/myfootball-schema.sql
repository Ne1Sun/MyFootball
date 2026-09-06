-- MyFootball India - production-ready relational model
-- Designed for PostgreSQL. UUID generation uses gen_random_uuid().

CREATE TYPE user_role AS ENUM ('organizer', 'club_manager', 'official', 'player', 'fan', 'admin');
CREATE TYPE tournament_status AS ENUM ('draft', 'registration_open', 'registration_closed', 'scheduled', 'live', 'completed', 'cancelled');
CREATE TYPE competition_format AS ENUM ('single_round_robin', 'double_round_robin', 'knockout', 'group_knockout');
CREATE TYPE entry_status AS ENUM ('pending', 'approved', 'waitlisted', 'withdrawn', 'barred');
CREATE TYPE payment_status AS ENUM ('unpaid', 'pending', 'paid', 'failed', 'refunded', 'waived');
CREATE TYPE fixture_status AS ENUM ('draft', 'scheduled', 'live', 'completed', 'postponed', 'cancelled');
CREATE TYPE match_event_type AS ENUM ('goal', 'assist', 'save', 'foul', 'yellow_card', 'red_card', 'substitution');

CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone_e164 VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  preferred_state VARCHAR(100),
  preferred_city VARCHAR(100),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role user_role NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE clubs (
  club_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(user_id),
  name VARCHAR(255) NOT NULL,
  organization_type VARCHAR(40) NOT NULL DEFAULT 'club',
  contact_person_name VARCHAR(100) NOT NULL,
  contact_phone_e164 VARCHAR(20) NOT NULL,
  city VARCHAR(100),
  logo_object_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tournaments (
  tournament_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(user_id),
  name VARCHAR(255) NOT NULL,
  organized_by_name VARCHAR(255) NOT NULL,
  status tournament_status NOT NULL DEFAULT 'draft',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  contact_name VARCHAR(100) NOT NULL,
  contact_phone_e164 VARCHAR(20) NOT NULL,
  poster_object_key TEXT,
  registration_closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE venues (
  venue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address_line_1 VARCHAR(255) NOT NULL,
  locality VARCHAR(120) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code CHAR(6) NOT NULL CHECK (postal_code ~ '^[0-9]{6}$'),
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  pitch_count INTEGER NOT NULL DEFAULT 1 CHECK (pitch_count > 0)
);

CREATE TABLE tournament_follows (
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tournament_id)
);

CREATE TABLE divisions (
  division_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  age_cutoff_date DATE,
  format competition_format NOT NULL,
  max_squad_size INTEGER CHECK (max_squad_size > 0),
  max_teams INTEGER NOT NULL CHECK (max_teams > 1),
  participation_fee_paise BIGINT NOT NULL DEFAULT 0 CHECK (participation_fee_paise >= 0),
  fee_basis VARCHAR(20) NOT NULL DEFAULT 'per_team' CHECK (fee_basis IN ('per_team','per_player')),
  require_player_registration BOOLEAN NOT NULL DEFAULT FALSE,
  require_age_document BOOLEAN NOT NULL DEFAULT FALSE,
  win_points INTEGER NOT NULL DEFAULT 3,
  draw_points INTEGER NOT NULL DEFAULT 1,
  loss_points INTEGER NOT NULL DEFAULT 0,
  group_count INTEGER,
  qualifiers_per_group INTEGER,
  UNIQUE (tournament_id, name),
  CHECK (NOT require_age_document OR require_player_registration)
);

CREATE TABLE teams (
  team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(club_id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

CREATE TABLE tournament_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES divisions(division_id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(team_id),
  status entry_status NOT NULL DEFAULT 'pending',
  seed INTEGER,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  UNIQUE (division_id, team_id)
);

CREATE TABLE players (
  player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  user_id UUID UNIQUE REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_squads (
  entry_id UUID NOT NULL REFERENCES tournament_entries(entry_id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(player_id),
  shirt_number INTEGER CHECK (shirt_number BETWEEN 1 AND 99),
  is_captain BOOLEAN NOT NULL DEFAULT FALSE,
  registration_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (entry_id, player_id),
  UNIQUE (entry_id, shirt_number)
);

CREATE TABLE player_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL,
  player_id UUID NOT NULL,
  document_type VARCHAR(40) NOT NULL,
  object_key TEXT NOT NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(user_id),
  reviewed_at TIMESTAMPTZ,
  FOREIGN KEY (entry_id, player_id) REFERENCES team_squads(entry_id, player_id) ON DELETE CASCADE
);

CREATE TABLE payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES tournament_entries(entry_id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'unpaid',
  provider VARCHAR(30),
  provider_reference VARCHAR(255) UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rounds (
  round_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES divisions(division_id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  stage_type VARCHAR(20) NOT NULL CHECK (stage_type IN ('league','group','knockout')),
  sequence_number INTEGER NOT NULL,
  start_date DATE,
  UNIQUE (division_id, sequence_number)
);

CREATE TABLE fixtures (
  fixture_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(round_id) ON DELETE CASCADE,
  home_entry_id UUID REFERENCES tournament_entries(entry_id),
  away_entry_id UUID REFERENCES tournament_entries(entry_id),
  venue_id UUID REFERENCES venues(venue_id),
  pitch_number INTEGER,
  kickoff_at TIMESTAMPTZ,
  status fixture_status NOT NULL DEFAULT 'draft',
  home_score INTEGER CHECK (home_score >= 0),
  away_score INTEGER CHECK (away_score >= 0),
  winner_entry_id UUID REFERENCES tournament_entries(entry_id),
  published_at TIMESTAMPTZ,
  CHECK (home_entry_id IS NULL OR away_entry_id IS NULL OR home_entry_id <> away_entry_id)
);

CREATE TABLE match_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES fixtures(fixture_id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES tournament_entries(entry_id),
  player_id UUID REFERENCES players(player_id),
  related_player_id UUID REFERENCES players(player_id),
  event_type match_event_type NOT NULL,
  match_minute INTEGER NOT NULL CHECK (match_minute BETWEEN 0 AND 200),
  added_time INTEGER NOT NULL DEFAULT 0 CHECK (added_time >= 0),
  recorded_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
  announcement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(user_id),
  title VARCHAR(160),
  body TEXT NOT NULL,
  audience VARCHAR(30) NOT NULL DEFAULT 'all_participants',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_deliveries (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(announcement_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app','email','push','sms','whatsapp')),
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  read_at TIMESTAMPTZ
);

CREATE TABLE tournament_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  object_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tournament_entries_status_idx ON tournament_entries (division_id, status);
CREATE INDEX fixtures_round_kickoff_idx ON fixtures (round_id, kickoff_at);
CREATE INDEX match_events_fixture_minute_idx ON match_events (fixture_id, match_minute, created_at);
CREATE INDEX payments_entry_status_idx ON payments (entry_id, status);
CREATE INDEX notifications_user_unread_idx ON notification_deliveries (user_id, read_at);
CREATE INDEX venues_area_idx ON venues (state, city, locality);
CREATE INDEX tournament_follows_user_idx ON tournament_follows (user_id, created_at DESC);
