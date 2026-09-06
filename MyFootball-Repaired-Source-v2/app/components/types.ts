export type Tournament = {
  id: string;
  name: string;
  organizedBy: string;
  city: string;
  venueName: string;
  addressLine1: string;
  locality: string;
  state: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  startDate: string;
  durationDays: number;
  status: string;
  contactName: string;
  contactPhone: string;
  createdAt: string;
};

export type Division = {
  id: string;
  tournamentId: string;
  name: string;
  format: string;
  maxSquadSize: number;
  maxTeams: number;
  groupsCount: number;
  teamsAdvancingPerGroup: number;
  feePaise: number;
  feeBasis: string;
  requirePlayers: boolean;
  requireDocuments: boolean;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  matchDurationMinutes: number;
  halfTimeBreakMinutes: number;
  bufferMinutes: number;
  minRestMinutes: number;
  ageCutoffDate?: string | null;
};

export type Entry = {
  id: string;
  divisionId: string;
  teamId: string;
  clubId: string;
  teamName: string;
  clubName: string;
  city: string;
  contactName: string;
  contactPhone: string;
  status: string;
  paymentStatus: string;
  amountPaise: number;
  seed?: number | null;
  groupName: string;
  notes: string;
  registeredAt: string;
};

export type Player = {
  id: string;
  clubId: string;
  name: string;
  dateOfBirth?: string | null;
  jerseyNumber: number;
  position: string; // "GK" | "DEF" | "MID" | "FWD"
  isCaptain: boolean;
  photoUrl?: string;
  createdAt: string;
};

export type SquadMember = {
  id: string;
  entryId: string;
  playerId: string;
  isStarting: boolean;
  jerseyNumberOverride?: number | null;
  positionOverride?: string | null;
  registeredAt: string;
};

export type Fixture = {
  id: string;
  divisionId: string;
  roundNumber: number;
  roundName: string;
  stage: string; // "group" | "knockout"
  bracketRound?: string | null; // "round_of_16" | "quarter_final" | "semi_final" | "third_place" | "final"
  bracketMatchIndex?: number | null;
  homeEntryId: string;
  awayEntryId: string;
  kickoffAt: string;
  pitch: number;
  status: string; // "scheduled" | "in_progress" | "completed"
  period: string; // "scheduled" | "first_half" | "half_time" | "second_half" | "extra_time" | "penalties" | "completed"
  matchClockMinute: number;
  homeScore: number;
  awayScore: number;
  homeScorePenalties: number;
  awayScorePenalties: number;
  potmPlayerId?: string | null;
  potmPlayerName?: string;
};

export type MatchEvent = {
  id: string;
  fixtureId: string;
  entryId: string;
  type: string; // "goal" | "penalty_goal" | "own_goal" | "yellow_card" | "red_card" | "substitution" | "penalty_miss"
  playerName: string;
  playerId?: string | null;
  assistPlayerName?: string;
  assistPlayerId?: string | null;
  relatedPlayerName?: string;
  matchMinute: number;
  matchPeriod: string;
  cardReason?: string;
  recordedBy: string;
  createdAt: string;
};

export type Announcement = {
  id: string;
  tournamentId: string;
  body: string;
  audience: string;
  createdAt: string;
};

export type AppData = {
  tournaments: Tournament[];
  divisions: Division[];
  entries: Entry[];
  fixtures: Fixture[];
  events: MatchEvent[];
  announcements: Announcement[];
  players: Player[];
  squadMembers: SquadMember[];
};
