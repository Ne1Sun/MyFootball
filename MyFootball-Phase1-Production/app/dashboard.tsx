"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CircleDot,
  ClipboardCopy,
  Clock3,
  Compass,
  Crown,
  FastForward,
  Globe,
  IndianRupee,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquareText,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type { ChatGPTUser } from "./chatgpt-auth";
import ThemeToggle from "./theme-toggle";
import type { AppData, ClubStaffAssignment, Division, Entry, Fixture, MatchEvent, Player, SquadMember, Tournament } from "./components/types";
import { SquadManager } from "./components/squads/SquadManager";
import { LiveMatchConsole } from "./components/matchday/LiveMatchConsole";
import { KnockoutBracket } from "./components/brackets/KnockoutBracket";
import { LeaderboardsView } from "./components/stats/LeaderboardsView";
import { StandingsView } from "./components/standings/StandingsView";

type View =
  | "Overview"
  | "Tournaments"
  | "Teams"
  | "Squads"
  | "Brackets"
  | "Matchday"
  | "Standings"
  | "Stats"
  | "Inbox";

const emptyData: AppData = {
  tournaments: [],
  divisions: [],
  entries: [],
  fixtures: [],
  events: [],
  announcements: [],
  players: [],
  squadMembers: [],
  clubStaffAssignments: [],
  fixtureOfficials: [],
  shootoutKicks: [],
  auditLogs: [],
};

const nav: Array<{ label: View; icon: typeof Trophy; badge?: string }> = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Tournaments", icon: Trophy },
  { label: "Teams", icon: ShieldCheck },
  { label: "Squads", icon: Users, badge: "New" },
  { label: "Brackets", icon: CalendarDays, badge: "Live" },
  { label: "Matchday", icon: Swords, badge: "Live" },
  { label: "Standings", icon: BarChart3 },
  { label: "Stats", icon: Award, badge: "New" },
  { label: "Inbox", icon: MessageSquareText },
];

const ageOptions = ["U-10", "U-12", "U-14", "U-16", "U-17", "U-18", "Open"];

const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    paise / 100
  );
const dateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const timeLabel = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

const indiaDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <CircleDot size={21} strokeWidth={2.4} />
      </span>
      <span>
        my<span>football</span>
      </span>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-top">
          <div>
            <span className="eyebrow">MyFootball operations</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateTournament({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [ages, setAges] = useState(["U-17"]);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState({ latitude: "", longitude: "" });
  const [locationError, setLocationError] = useState("");

  const usePosition = () => {
    if (!navigator.geolocation) {
      setLocationError("Location access is not available in this browser. Enter the coordinates manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocationError("");
      },
      () => setLocationError("Location permission was denied. Enter the ground coordinates manually."),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const saved = await onSaved({
      action: "createTournament",
      name: form.get("name"),
      organizedBy: form.get("organizedBy"),
      city: form.get("city"),
      venueName: form.get("venueName"),
      addressLine1: form.get("addressLine1"),
      locality: form.get("locality"),
      state: form.get("state"),
      postalCode: form.get("postalCode"),
      latitude: form.get("latitude"),
      longitude: form.get("longitude"),
      startDate: form.get("startDate"),
      registrationClosesAt: form.get("registrationClosesAt"),
      durationDays: form.get("durationDays"),
      contactName: form.get("contactName"),
      contactPhone: form.get("contactPhone"),
      format: form.get("format"),
      maxTeams: form.get("maxTeams"),
      includeThirdPlace: form.get("includeThirdPlace") === "on",
      maxSquadSize: form.get("maxSquadSize"),
      feeRupees: form.get("feeRupees"),
      ageGroups: ages,
      requirePlayers: form.get("requirePlayers") === "on",
      requireDocuments: form.get("requireDocuments") === "on",
    });
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <Modal title="Create a tournament" subtitle="Every field below is saved to your organizer account." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field field-wide">
              <span>Tournament name</span>
              <input name="name" placeholder="e.g. Mumbai Super Cup 2026" required autoFocus />
            </label>
            <label className="field">
              <span>Organized by</span>
              <input name="organizedBy" placeholder="Academy or organization" required />
            </label>
            <label className="field">
              <span>Venue / ground name</span>
              <input name="venueName" placeholder="Cooperage Football Ground" required />
            </label>
            <label className="field field-wide">
              <span>Street address</span>
              <input name="addressLine1" placeholder="Madame Cama Road, Colaba" required />
            </label>
            <label className="field">
              <span>Locality / area</span>
              <input name="locality" placeholder="Colaba" required />
            </label>
            <label className="field">
              <span>City</span>
              <input name="city" placeholder="Mumbai" required />
            </label>
            <label className="field">
              <span>State</span>
              <input name="state" placeholder="Maharashtra" required />
            </label>
            <label className="field">
              <span>PIN code</span>
              <input name="postalCode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="400001" required />
            </label>
            <label className="field">
              <span>Latitude</span>
              <input
                name="latitude"
                value={coords.latitude}
                onChange={(event) => setCoords({ ...coords, latitude: event.target.value })}
                placeholder="18.924800"
                required
              />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input
                name="longitude"
                value={coords.longitude}
                onChange={(event) => setCoords({ ...coords, longitude: event.target.value })}
                placeholder="72.828600"
                required
              />
            </label>
            <button className="location-helper field-wide" type="button" onClick={usePosition}>
              <MapPin size={15} /> Use my current coordinates
            </button>
            {locationError && <p className="field-wide text-xs font-semibold text-rose-500" role="alert">{locationError}</p>}
            <label className="field">
              <span>Start date</span>
              <input name="startDate" type="date" required />
            </label>
            <label className="field">
              <span>Registration closes (IST)</span>
              <input name="registrationClosesAt" type="datetime-local" />
            </label>
            <label className="field">
              <span>Duration</span>
              <select name="durationDays" defaultValue="3">
                <option value="1">1 day</option>
                <option value="2">2 days</option>
                <option value="3">3 days</option>
                <option value="5">5 days</option>
                <option value="14">2 weeks</option>
                <option value="28">4 weekends</option>
              </select>
            </label>
            <label className="field">
              <span>Contact name</span>
              <input name="contactName" required />
            </label>
            <label className="field">
              <span>Contact phone</span>
              <input name="contactPhone" type="tel" placeholder="+91..." required />
            </label>
            <label className="field">
              <span>Tournament Format</span>
              <select name="format" defaultValue="group_knockout">
                <option value="group_knockout">Group Stage + Knockout Bracket</option>
                <option value="round_robin">Round Robin League</option>
                <option value="knockout">Pure Knockout Cup</option>
              </select>
            </label>
            <label className="field">
              <span>Maximum teams per division</span>
              <input name="maxTeams" type="number" min="2" max="128" defaultValue="16" required />
            </label>
            <label className="field">
              <span>Maximum squad size</span>
              <input name="maxSquadSize" type="number" min="5" max="50" defaultValue="18" />
            </label>
            <label className="field">
              <span>Fee per team (₹)</span>
              <input name="feeRupees" type="number" min="0" defaultValue="3500" />
            </label>
            <div className="field field-wide">
              <span>Divisions</span>
              <div className="chip-picker">
                {ageOptions.map((age) => (
                  <button
                    type="button"
                    className={ages.includes(age) ? "pick selected" : "pick"}
                    key={age}
                    onClick={() =>
                      setAges((current) =>
                        current.includes(age) ? current.filter((item) => item !== age) : [...current, age]
                      )
                    }
                  >
                    {ages.includes(age) && <Check size={13} />}
                    {age}
                  </button>
                ))}
              </div>
            </div>
            <label className="toggle-row field-wide">
              <div>
                <strong>Include a third-place playoff</strong>
                <small>Used when a knockout stage reaches two semi-finals</small>
              </div>
              <input name="includeThirdPlace" type="checkbox" />
            </label>
            <label className="toggle-row field-wide">
              <div>
                <strong>Collect player lists</strong>
                <small>Enable squad rosters and player stats tracking</small>
              </div>
              <input name="requirePlayers" type="checkbox" defaultChecked />
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !ages.length}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Create tournament
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditTournament({
  tournament,
  onClose,
  onSaved,
}: {
  tournament: Tournament;
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState({
    latitude: tournament.latitude,
    longitude: tournament.longitude,
  });
  const [locationError, setLocationError] = useState("");

  const usePosition = () => {
    if (!navigator.geolocation) {
      setLocationError("Location access is not available in this browser. Enter the coordinates manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocationError("");
      },
      () => setLocationError("Location permission was denied. Enter the ground coordinates manually."),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const saved = await onSaved({
      action: "updateTournament",
      tournamentId: tournament.id,
      name: form.get("name"),
      organizedBy: form.get("organizedBy"),
      venueName: form.get("venueName"),
      addressLine1: form.get("addressLine1"),
      locality: form.get("locality"),
      city: form.get("city"),
      state: form.get("state"),
      postalCode: form.get("postalCode"),
      latitude: form.get("latitude"),
      longitude: form.get("longitude"),
      startDate: form.get("startDate"),
      registrationClosesAt: form.get("registrationClosesAt"),
      durationDays: form.get("durationDays"),
      status: form.get("status"),
      contactName: form.get("contactName"),
      contactPhone: form.get("contactPhone"),
    });
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <Modal
      title="Edit tournament"
      subtitle="Changes update the organizer hub, public listing and registration page."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field field-wide">
              <span>Tournament name</span>
              <input name="name" defaultValue={tournament.name} required autoFocus />
            </label>
            <label className="field">
              <span>Organized by</span>
              <input name="organizedBy" defaultValue={tournament.organizedBy} required />
            </label>
            <label className="field">
              <span>Tournament status</span>
              <select name="status" defaultValue={tournament.status}>
                <option value="registration_open">Registration open</option>
                <option value="registration_closed">Registration closed</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="field">
              <span>Venue / ground name</span>
              <input name="venueName" defaultValue={tournament.venueName} required />
            </label>
            <label className="field field-wide">
              <span>Street address</span>
              <input name="addressLine1" defaultValue={tournament.addressLine1} required />
            </label>
            <label className="field">
              <span>Locality / area</span>
              <input name="locality" defaultValue={tournament.locality} required />
            </label>
            <label className="field">
              <span>City</span>
              <input name="city" defaultValue={tournament.city} required />
            </label>
            <label className="field">
              <span>State</span>
              <input name="state" defaultValue={tournament.state} required />
            </label>
            <label className="field">
              <span>PIN code</span>
              <input name="postalCode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} defaultValue={tournament.postalCode} required />
            </label>
            <label className="field">
              <span>Latitude</span>
              <input name="latitude" value={coords.latitude} onChange={(event) => setCoords({ ...coords, latitude: event.target.value })} required />
            </label>
            <label className="field">
              <span>Longitude</span>
              <input name="longitude" value={coords.longitude} onChange={(event) => setCoords({ ...coords, longitude: event.target.value })} required />
            </label>
            <button className="location-helper field-wide" type="button" onClick={usePosition}>
              <MapPin size={15} /> Refresh with my current coordinates
            </button>
            {locationError && <p className="field-wide text-xs font-semibold text-rose-500" role="alert">{locationError}</p>}
            <label className="field">
              <span>Start date</span>
              <input name="startDate" type="date" defaultValue={tournament.startDate} required />
            </label>
            <label className="field">
              <span>Duration (days)</span>
              <input name="durationDays" type="number" min="1" max="60" defaultValue={tournament.durationDays} required />
            </label>
            <label className="field field-wide">
              <span>Registration closes (IST)</span>
              <input name="registrationClosesAt" type="datetime-local" defaultValue={indiaDateTimeInput(tournament.registrationClosesAt)} />
            </label>
            <label className="field">
              <span>Contact name</span>
              <input name="contactName" defaultValue={tournament.contactName} required />
            </label>
            <label className="field">
              <span>Contact phone</span>
              <input name="contactPhone" type="tel" defaultValue={tournament.contactPhone} required />
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Pencil size={17} />} Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddTeamModal({
  divisions,
  onClose,
  onSaved,
}: {
  divisions: Division[];
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const saved = await onSaved({
      action: "addTeam",
      divisionId: form.get("divisionId"),
      clubName: form.get("clubName"),
      teamName: form.get("teamName"),
      organizationType: form.get("organizationType"),
      city: form.get("city"),
      contactName: form.get("contactName"),
      contactPhone: form.get("contactPhone"),
      paymentStatus: form.get("paymentStatus"),
      groupName: form.get("groupName"),
      approved: form.get("approved") === "on",
    });
    setBusy(false);
    if (saved) onClose();
  };
  return (
    <Modal title="Register Team" subtitle="Manual entries use the same database as public registrations." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field field-wide">
              <span>Division</span>
              <select name="divisionId">
                {divisions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Club / Academy Name</span>
              <input name="clubName" placeholder="Reliance Foundation Young Champs" required />
            </label>
            <label className="field">
              <span>Team Name</span>
              <input name="teamName" placeholder="RFYC U17" required />
            </label>
            <label className="field">
              <span>Organization Type</span>
              <select name="organizationType">
                <option value="academy">Academy</option>
                <option value="club">Club</option>
                <option value="school">School</option>
                <option value="institution">Institution</option>
              </select>
            </label>
            <label className="field">
              <span>Assigned Group</span>
              <select name="groupName">
                <option value="Group A">Group A</option>
                <option value="Group B">Group B</option>
                <option value="Group C">Group C</option>
                <option value="Group D">Group D</option>
              </select>
            </label>
            <label className="field">
              <span>City</span>
              <input name="city" placeholder="Mumbai" />
            </label>
            <label className="field">
              <span>Contact Person</span>
              <input name="contactName" required />
            </label>
            <label className="field">
              <span>Mobile Number</span>
              <input name="contactPhone" type="tel" required />
            </label>
            <label className="field">
              <span>Payment Status</span>
              <select name="paymentStatus">
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="waived">Waived</option>
              </select>
            </label>
            <label className="toggle-row field-wide">
              <div>
                <strong>Approve immediately</strong>
                <small>Add directly to tournament fixture pool</small>
              </div>
              <input name="approved" type="checkbox" defaultChecked />
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Save Team
          </button>
        </div>
      </form>
    </Modal>
  );
}

function GenerateFixturesModal({
  divisions,
  onClose,
  onSaved,
}: {
  divisions: Division[];
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [selectedDivisionId, setSelectedDivisionId] = useState(divisions[0]?.id || "");
  const selectedDivision = divisions.find((division) => division.id === selectedDivisionId) || divisions[0];
  const [mode, setMode] = useState(selectedDivision?.format || "group_knockout");
  const [includeThirdPlace, setIncludeThirdPlace] = useState(selectedDivision?.includeThirdPlace || false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const saved = await onSaved({
      action: "generateFixtures",
      divisionId: form.get("divisionId"),
      mode: form.get("mode"),
      startDate: form.get("startDate"),
      startTime: form.get("startTime"),
      pitches: form.get("pitches"),
      slotMinutes: form.get("slotMinutes"),
      teamsAdvancingPerGroup: form.get("teamsAdvancingPerGroup"),
      includeThirdPlace,
    });
    setBusy(false);
    if (saved) onClose();
  };
  return (
    <Modal title="Generate Fixtures & Brackets" subtitle="Approved teams are scheduled with pitch and bracket slots." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field field-wide">
              <span>Division</span>
              <select
                name="divisionId"
                value={selectedDivisionId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const nextDivision = divisions.find((division) => division.id === nextId);
                  setSelectedDivisionId(nextId);
                  setMode(nextDivision?.format || "group_knockout");
                  setIncludeThirdPlace(nextDivision?.includeThirdPlace || false);
                }}
              >
                {divisions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tournament Format</span>
              <select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="group_knockout">Group Stage + Knockout Bracket</option>
                <option value="knockout">Pure Knockout Bracket</option>
                <option value="round_robin">Round Robin League</option>
              </select>
            </label>
            {mode === "group_knockout" && (
              <label className="field">
                <span>Teams advancing per group</span>
                <input
                  name="teamsAdvancingPerGroup"
                  type="number"
                  min="1"
                  max="32"
                  defaultValue={selectedDivision?.teamsAdvancingPerGroup || 2}
                  required
                />
              </label>
            )}
            <label className="field">
              <span>Start Date</span>
              <input name="startDate" type="date" required />
            </label>
            <label className="field">
              <span>First Kick-Off</span>
              <input name="startTime" type="time" defaultValue="09:00" required />
            </label>
            <label className="field">
              <span>Available Pitches</span>
              <input name="pitches" type="number" min="1" max="12" defaultValue="2" />
            </label>
            <label className="field field-wide">
              <span>Minutes Between Kick-Offs</span>
              <input name="slotMinutes" type="number" min="20" max="180" defaultValue="60" />
            </label>
            {mode !== "round_robin" && (
              <label className="toggle-row field-wide">
                <div>
                  <strong>Include a third-place playoff</strong>
                  <small>Automatically schedules the two semi-final losers when possible</small>
                </div>
                <input
                  name="includeThirdPlace"
                  type="checkbox"
                  checked={includeThirdPlace}
                  onChange={(event) => setIncludeThirdPlace(event.target.checked)}
                />
              </label>
            )}
            <div className="smart-note field-wide">
              <Sparkles size={18} />
              <div>
                <strong>Automatic Knockout Tree Generation</strong>
                <p>Builds a 2–128 team bracket, adds automatic byes, and progresses every round through the final.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Generate Schedule
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignStaffModal({
  entry,
  assignments,
  onClose,
  onSaved,
}: {
  entry: Entry;
  assignments: ClubStaffAssignment[];
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const saved = await onSaved({
      action: "assignClubStaff",
      clubId: entry.clubId,
      userEmail: form.get("userEmail"),
      role: form.get("role"),
      status: "active",
    });
    setBusy(false);
    if (saved) onClose();
  };
  return (
    <Modal title="Assign team staff" subtitle={`Give a verified account access to ${entry.clubName}.`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field field-wide">
              <span>Staff account email</span>
              <input name="userEmail" type="email" placeholder="coach@example.com" required autoFocus />
            </label>
            <label className="field field-wide">
              <span>Role</span>
              <select name="role" defaultValue="coach">
                <option value="coach">Coach</option>
                <option value="manager">Team manager</option>
                <option value="assistant_coach">Assistant coach</option>
              </select>
            </label>
            {assignments.filter((assignment) => assignment.status === "active").length > 0 && (
              <div className="field-wide space-y-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Current staff</span>
                {assignments.filter((assignment) => assignment.status === "active").map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/40">
                    <div>
                      <strong className="text-sm text-foreground">{assignment.userEmail}</strong>
                      <p className="text-xs text-muted-foreground">{assignment.role.replaceAll("_", " ")}</p>
                    </div>
                    <button
                      type="button"
                      className="button secondary text-xs px-3 py-1.5"
                      onClick={() => void onSaved({
                        action: "assignClubStaff",
                        clubId: entry.clubId,
                        userEmail: assignment.userEmail,
                        role: assignment.role,
                        status: "revoked",
                      })}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} Assign access
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignRefereeModal({
  fixture,
  label,
  onClose,
  onSaved,
}: {
  fixture: Fixture;
  label: string;
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const saved = await onSaved({
      action: "assignFixtureOfficial",
      fixtureId: fixture.id,
      userEmail: form.get("userEmail"),
      status: "assigned",
    });
    setBusy(false);
    if (saved) onClose();
  };
  return (
    <Modal title="Assign referee" subtitle={`Grant match-only access for ${label}.`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Referee account email</span>
            <input name="userEmail" type="email" placeholder="referee@example.com" required autoFocus />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Clock3 size={17} />} Assign referee
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CorrectResultModal({
  fixture,
  label,
  onClose,
  onSaved,
}: {
  fixture: Fixture;
  label: string;
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const saved = await onSaved({
      action: "correctMatchResult",
      fixtureId: fixture.id,
      homeScore: form.get("homeScore"),
      awayScore: form.get("awayScore"),
      homeScorePenalties: form.get("homeScorePenalties"),
      awayScorePenalties: form.get("awayScorePenalties"),
      reason: form.get("reason"),
    });
    setBusy(false);
    if (saved) onClose();
  };
  return (
    <Modal title="Correct official result" subtitle={`${label}. The reason and before/after values are stored in the audit trail.`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field">
              <span>Home score</span>
              <input name="homeScore" type="number" min="0" defaultValue={fixture.homeScore} required />
            </label>
            <label className="field">
              <span>Away score</span>
              <input name="awayScore" type="number" min="0" defaultValue={fixture.awayScore} required />
            </label>
            {fixture.stage === "knockout" && (
              <>
                <label className="field">
                  <span>Home penalties</span>
                  <input name="homeScorePenalties" type="number" min="0" defaultValue={fixture.homeScorePenalties} required />
                </label>
                <label className="field">
                  <span>Away penalties</span>
                  <input name="awayScorePenalties" type="number" min="0" defaultValue={fixture.awayScorePenalties} required />
                </label>
              </>
            )}
            <label className="field field-wide">
              <span>Correction reason</span>
              <textarea name="reason" minLength={8} rows={3} placeholder="Explain the official correction" required />
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Pencil size={17} />} Save audited correction
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Dashboard({ user }: { user: ChatGPTUser }) {
  const [view, setView] = useState<View>("Overview");
  const [data, setData] = useState<AppData>(emptyData);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tournament | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [fixtureOpen, setFixtureOpen] = useState(false);
  const [matchdayFixtureId, setMatchdayFixtureId] = useState("");
  const [staffTarget, setStaffTarget] = useState<Entry | null>(null);
  const [refereeTarget, setRefereeTarget] = useState<Fixture | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<Fixture | null>(null);

  const activeTournament = useMemo(
    () => data.tournaments.find((t) => t.id === selectedId) || data.tournaments[0],
    [data.tournaments, selectedId]
  );

  const activeDivisions = useMemo(
    () => data.divisions.filter((d) => d.tournamentId === activeTournament?.id),
    [data.divisions, activeTournament]
  );

  const activeDivisionIds = useMemo(() => new Set(activeDivisions.map((d) => d.id)), [activeDivisions]);

  const activeEntries = useMemo(
    () => data.entries.filter((e) => activeDivisionIds.has(e.divisionId)),
    [data.entries, activeDivisionIds]
  );

  const activeFixtures = useMemo(
    () => data.fixtures.filter((f) => activeDivisionIds.has(f.divisionId)),
    [data.fixtures, activeDivisionIds]
  );

  const activeEvents = useMemo(() => {
    const fixIds = new Set(activeFixtures.map((f) => f.id));
    return data.events.filter((e) => fixIds.has(e.fixtureId));
  }, [data.events, activeFixtures]);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/app");
      if (!res.ok) throw new Error("Failed to load tournament data");
      const json = await res.json();
      setData(json);
      setSelectedId((current) => current || json.tournaments?.[0]?.id || "");
      if (!json.tournaments?.length) setView("Tournaments");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshData());
  }, [refreshData]);

  const handleSaveAction = async (payload: Record<string, unknown>) => {
    try {
      setBusy(true);
      const res = await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      const successMessages: Record<string, string> = {
        createTournament: "Tournament created successfully.",
        updateTournament: "Tournament details updated everywhere.",
        deleteTournament: "Tournament deleted.",
        addTeam: "Team registration saved.",
        updateEntry: "Registration decision saved.",
        assignClubStaff: "Team staff access updated.",
        assignFixtureOfficial: "Referee assignment saved.",
        correctMatchResult: "Official result corrected and bracket checked.",
        generateFixtures: "Schedule generated successfully.",
        sendAnnouncement: "Broadcast sent successfully.",
      };
      setToast(successMessages[String(payload.action)] || "Operation updated successfully.");
      setTimeout(() => setToast(""), 4000);
      await refreshData();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error performing action";
      setError(message);
      setToast("");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleOpenMatchday = (fixtureId: string) => {
    setMatchdayFixtureId(fixtureId);
    setView("Matchday");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ${
          sidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <Logo />
          <button className="lg:hidden p-1.5 text-muted-foreground" onClick={() => setSidebar(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <span className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground block mb-2">
            Active Competition
          </span>
          <select
            value={activeTournament?.id || ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full text-xs font-bold bg-muted/60 p-2.5 rounded-xl border border-border focus:outline-none cursor-pointer"
          >
            {data.tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.city})
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = view === item.label;
            return (
              <button
                key={item.label}
                type="button"
                disabled={!activeTournament && item.label !== "Tournaments"}
                onClick={() => {
                  if (!activeTournament && item.label !== "Tournaments") return;
                  setView(item.label);
                  setSidebar(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : !activeTournament && item.label !== "Tournaments"
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={!activeTournament && item.label !== "Tournaments" ? "Create a tournament to unlock this section" : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Platform Roles Portals */}
        <div className="p-3 border-t border-border space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground px-2 block mb-1">
            Platform Roles
          </span>
          <a
            href="/coach"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
          >
            <ShieldCheck size={16} className="text-emerald-500" />
            <span>Coach Portal</span>
          </a>
          <a
            href="/referee"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
          >
            <Clock3 size={16} className="text-amber-500" />
            <span>Referee Console</span>
          </a>
          <a
            href={activeTournament ? `/tournament/${activeTournament.id}` : "/discover"}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
          >
            <Globe size={16} className="text-primary" />
            <span>Public Showcase</span>
          </a>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="truncate">
            <strong className="block text-foreground truncate">{user.displayName}</strong>
            <span className="truncate">{user.email}</span>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg bg-muted" onClick={() => setSidebar(true)}>
              <Menu size={18} />
            </button>
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Organizer Hub</span>
              <h1 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                {activeTournament?.name || "MyFootball India"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/coach"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition"
            >
              <ShieldCheck size={14} className="text-emerald-500" /> Coach
            </a>
            <a
              href="/referee"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition"
            >
              <Clock3 size={14} className="text-amber-500" /> Referee
            </a>
            {activeTournament && (
              <a
                href={`/tournament/${activeTournament.id}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition"
              >
                <Globe size={14} className="text-primary" /> Public Hub
              </a>
            )}
            <button
              onClick={() => setCreateOpen(true)}
              className="button primary inline-flex items-center gap-1.5 text-xs px-3.5 py-2"
            >
              <Plus size={15} /> New Tournament
            </button>
            <button
              onClick={refreshData}
              disabled={loading}
              className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground transition"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <Sparkles size={18} className="text-amber-400" />
            <span className="text-sm font-semibold">{toast}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mx-4 lg:mx-8 mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="p-1 hover:bg-rose-500/20 rounded">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* TAB 1: OVERVIEW */}
          {view === "Overview" && (
            <div className="space-y-6">
              {/* Active Tournament Hero Banner */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-8 border border-emerald-500/20 shadow-xl">
                <div className="relative z-10 space-y-4 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    LIVE COMPETITION HUB
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tight">{activeTournament?.name}</h2>
                  <p className="text-slate-300 text-sm sm:text-base">
                    {activeTournament?.venueName}, {activeTournament?.locality}, {activeTournament?.city} • {activeTournament?.durationDays} Days Event
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => activeTournament && setEditTarget(activeTournament)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-bold text-sm text-white border border-white/15 transition"
                    >
                      <Pencil size={16} /> Edit Tournament
                    </button>
                    <button
                      onClick={() => setView("Matchday")}
                      className="button primary inline-flex items-center gap-2 text-sm px-4 py-2.5"
                    >
                      <Swords size={16} /> Open Live Matchday Console
                    </button>
                    <button
                      onClick={() => setView("Brackets")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-sm text-white border border-slate-700 transition"
                    >
                      <Trophy size={16} className="text-amber-400" /> View Elimination Bracket
                    </button>
                  </div>
                </div>
              </div>

              {/* KPI Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="panel-card p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs uppercase font-bold tracking-wider">Divisions</span>
                    <Trophy size={18} className="text-primary" />
                  </div>
                  <div className="font-mono font-black text-3xl text-foreground">{activeDivisions.length}</div>
                  <span className="text-xs text-muted-foreground">Age categories configured</span>
                </div>

                <div className="panel-card p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs uppercase font-bold tracking-wider">Registered Teams</span>
                    <ShieldCheck size={18} className="text-emerald-500" />
                  </div>
                  <div className="font-mono font-black text-3xl text-foreground">{activeEntries.length}</div>
                  <span className="text-xs text-muted-foreground">Clubs & academies</span>
                </div>

                <div className="panel-card p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs uppercase font-bold tracking-wider">Player Rosters</span>
                    <Users size={18} className="text-blue-500" />
                  </div>
                  <div className="font-mono font-black text-3xl text-foreground">{data.players.length}</div>
                  <span className="text-xs text-muted-foreground">Players registered in pool</span>
                </div>

                <div className="panel-card p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs uppercase font-bold tracking-wider">Match Events</span>
                    <TrendingUp size={18} className="text-amber-500" />
                  </div>
                  <div className="font-mono font-black text-3xl text-foreground">{activeEvents.length}</div>
                  <span className="text-xs text-muted-foreground">Goals, cards & subs recorded</span>
                </div>
              </div>

              {/* Quick Jump Modules */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Fixtures / Live Matches */}
                <div className="panel-card p-6 rounded-2xl bg-card border border-border space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                      <Swords size={18} className="text-primary" /> Key Match Highlights
                    </h3>
                    <button onClick={() => setView("Brackets")} className="text-xs text-primary font-bold hover:underline">
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {activeFixtures.slice(0, 4).map((f) => {
                      const h = activeEntries.find((e) => e.id === f.homeEntryId);
                      const a = activeEntries.find((e) => e.id === f.awayEntryId);
                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition border border-border"
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">{f.roundName}</span>
                            <div className="font-bold text-sm text-foreground">
                              {h?.teamName || "TBD"} vs {a?.teamName || "TBD"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-base text-foreground">
                              {f.status === "completed" || f.status === "in_progress"
                                ? `${f.homeScore} - ${f.awayScore}`
                                : "vs"}
                            </span>
                            <button
                              onClick={() => handleOpenMatchday(f.id)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 transition"
                            >
                              Console
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tournament Standings Snapshot */}
                <div className="panel-card p-6 rounded-2xl bg-card border border-border space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                      <BarChart3 size={18} className="text-primary" /> Standings Preview
                    </h3>
                    <button onClick={() => setView("Standings")} className="text-xs text-primary font-bold hover:underline">
                      Full Tables
                    </button>
                  </div>
                  <div className="space-y-2">
                    {activeEntries.slice(0, 5).map((entry, i) => (
                      <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-muted-foreground w-4">{i + 1}</span>
                          <strong className="text-sm text-foreground">{entry.teamName}</strong>
                          <span className="text-xs text-muted-foreground">({entry.groupName})</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {entry.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TOURNAMENTS */}
          {view === "Tournaments" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">Your Tournaments</h2>
                  <p className="text-xs text-muted-foreground">Manage tournament information and exact venue locations.</p>
                </div>
                <button onClick={() => setCreateOpen(true)} className="button primary inline-flex items-center gap-2 text-sm">
                  <Plus size={16} /> Create Tournament
                </button>
              </div>

              {data.tournaments.length === 0 ? (
                <div className="panel-card rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
                  <Trophy size={38} className="mx-auto text-primary" />
                  <h3 className="mt-3 text-lg font-extrabold">Create your first tournament</h3>
                  <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                    The organizer controls unlock after your first competition is saved. Your fan account remains active at the same time.
                  </p>
                  <button onClick={() => setCreateOpen(true)} className="button primary mt-5 inline-flex items-center gap-2 text-sm">
                    <Plus size={16} /> Create Tournament
                  </button>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.tournaments.map((t) => (
                  <div key={t.id} className="panel-card p-6 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {t.status.replace("_", " ").toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">Starts {dateLabel(t.startDate)}</span>
                    </div>

                    <div>
                      <h3 className="font-black text-xl text-foreground">{t.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Organized by {t.organizedBy}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1.5 border border-border">
                      <div className="flex items-center gap-2 text-foreground font-semibold">
                        <MapPin size={14} className="text-primary" /> {t.venueName}
                      </div>
                      <div className="text-muted-foreground">
                        {t.addressLine1}, {t.locality}, {t.city}, {t.state} - {t.postalCode}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        GPS: {t.latitude}, {t.longitude}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedId(t.id);
                            setView("Overview");
                          }}
                          className="button secondary text-xs px-3 py-1.5"
                        >
                          Select Competition
                        </button>
                        <button
                          onClick={() => setEditTarget(t)}
                          className="button secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete tournament "${t.name}"?`)) {
                            void handleSaveAction({ action: "deleteTournament", tournamentId: t.id });
                          }
                        }}
                        className="p-2 text-muted-foreground hover:text-rose-500 transition"
                        aria-label={`Delete ${t.name}`}
                        title="Delete tournament"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {/* TAB 3: TEAMS */}
          {view === "Teams" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">Registered Teams</h2>
                  <p className="text-xs text-muted-foreground">Approve team entries and assign group stages.</p>
                </div>
                <button onClick={() => setTeamOpen(true)} className="button primary inline-flex items-center gap-2 text-sm">
                  <Plus size={16} /> Register Team
                </button>
              </div>

              <div className="panel-card rounded-2xl p-5 bg-card border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground text-left">
                      <th className="py-2.5 px-3">Team & Club</th>
                      <th className="py-2.5 px-3">City</th>
                      <th className="py-2.5 px-3">Assigned Group</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Shield size={16} className="text-primary" />
                            <div>
                              <strong className="text-foreground">{entry.teamName}</strong>
                              <div className="text-[11px] text-muted-foreground">{entry.clubName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{entry.city}</td>
                        <td className="py-3 px-3">
                          <select
                            value={entry.groupName}
                            disabled={busy}
                            onChange={(event) => void handleSaveAction({
                              action: "updateEntry",
                              entryId: entry.id,
                              groupName: event.target.value,
                              status: entry.status,
                              paymentStatus: entry.paymentStatus,
                            })}
                            className="text-xs bg-muted p-1.5 rounded-lg border border-border text-foreground"
                            aria-label={`Group for ${entry.teamName}`}
                          >
                            {Array.from({ length: Math.max(1, activeDivisions.find((division) => division.id === entry.divisionId)?.groupsCount || 1) }, (_, index) => (
                              <option key={index} value={`Group ${String.fromCharCode(65 + index)}`}>
                                Group {String.fromCharCode(65 + index)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {entry.contactName}
                          <div className="font-mono text-[10px]">{entry.contactPhone}</div>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={entry.paymentStatus}
                            disabled={busy}
                            onChange={(event) => void handleSaveAction({
                              action: "updateEntry",
                              entryId: entry.id,
                              paymentStatus: event.target.value,
                              status: entry.status,
                              groupName: entry.groupName,
                            })}
                            className="text-xs bg-muted p-1.5 rounded-lg border border-border text-foreground"
                            aria-label={`Payment status for ${entry.teamName}`}
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="waived">Waived</option>
                            <option value="refunded">Refunded</option>
                          </select>
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={entry.status}
                            disabled={busy}
                            onChange={(event) => void handleSaveAction({
                              action: "updateEntry",
                              entryId: entry.id,
                              status: event.target.value,
                              paymentStatus: entry.paymentStatus,
                              groupName: entry.groupName,
                            })}
                            className="text-xs bg-muted p-1.5 rounded-lg border border-border text-foreground"
                            aria-label={`Registration status for ${entry.teamName}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="withdrawn">Withdrawn</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setStaffTarget(entry)}
                              className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20 transition"
                            >
                              Assign Staff
                            </button>
                            <button
                              onClick={() => {
                                setSelectedId(activeTournament.id);
                                setView("Squads");
                              }}
                              className="text-xs px-2.5 py-1 rounded bg-primary/10 text-primary font-bold hover:bg-primary/20 transition"
                            >
                              Manage Squad
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SQUADS & ROSTERS (STEP 1) */}
          {view === "Squads" && (
            <SquadManager
              divisions={activeDivisions}
              entries={activeEntries}
              players={data.players}
              squadMembers={data.squadMembers}
              onSaveAction={handleSaveAction}
            />
          )}

          {/* TAB 5: BRACKETS & KNOCKOUT TREE (STEP 1) */}
          {view === "Brackets" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">Elimination Brackets & Fixtures</h2>
                  <p className="text-xs text-muted-foreground">Interactive tournament trees with automatic winner progression.</p>
                </div>
                <button onClick={() => setFixtureOpen(true)} className="button primary inline-flex items-center gap-2 text-sm">
                  <Sparkles size={16} /> Generate Schedule
                </button>
              </div>

              <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-3">
                <div>
                  <h3 className="font-bold text-foreground">Fixture officials & result control</h3>
                  <p className="text-xs text-muted-foreground">Assign one referee per match. Completed results can only change through the audited correction workflow.</p>
                </div>
                {activeFixtures.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Generate a schedule to assign officials.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {activeFixtures.map((fixture) => {
                      const home = activeEntries.find((entry) => entry.id === fixture.homeEntryId);
                      const away = activeEntries.find((entry) => entry.id === fixture.awayEntryId);
                      const label = `${home?.teamName || "Home"} vs ${away?.teamName || "Away"}`;
                      const official = data.fixtureOfficials.find((item) => item.fixtureId === fixture.id && item.status === "assigned");
                      return (
                        <div key={fixture.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <strong className="text-sm text-foreground">{label}</strong>
                            <p className="text-xs text-muted-foreground">{fixture.roundName} · {timeLabel(fixture.kickoffAt)} · {official ? `Referee: ${official.userEmail}` : "Referee unassigned"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className="button secondary text-xs px-3 py-1.5" onClick={() => setRefereeTarget(fixture)}>
                              <Clock3 size={14} /> {official ? "Change referee" : "Assign referee"}
                            </button>
                            {official && (
                              <button
                                className="button secondary text-xs px-3 py-1.5"
                                onClick={() => void handleSaveAction({
                                  action: "assignFixtureOfficial",
                                  fixtureId: fixture.id,
                                  userEmail: official.userEmail,
                                  status: "revoked",
                                })}
                              >
                                Revoke referee
                              </button>
                            )}
                            <button className="button secondary text-xs px-3 py-1.5" onClick={() => handleOpenMatchday(fixture.id)}>
                              <Swords size={14} /> Matchday
                            </button>
                            {fixture.status === "completed" && (
                              <button className="button secondary text-xs px-3 py-1.5" onClick={() => setCorrectionTarget(fixture)}>
                                <Pencil size={14} /> Correct result
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <KnockoutBracket
                divisions={activeDivisions}
                entries={activeEntries}
                fixtures={activeFixtures}
                onSaveAction={handleSaveAction}
                onOpenMatchday={handleOpenMatchday}
              />
            </div>
          )}

          {/* TAB 6: PITCH-SIDE LIVE MATCHDAY CONSOLE (STEP 1) */}
          {view === "Matchday" && (
            <LiveMatchConsole
              key={matchdayFixtureId || "default-matchday"}
              initialFixtureId={matchdayFixtureId}
              divisions={activeDivisions}
              entries={activeEntries}
              fixtures={activeFixtures}
              events={activeEvents}
              players={data.players}
              squadMembers={data.squadMembers}
              onSaveAction={handleSaveAction}
            />
          )}

          {/* TAB 7: STANDINGS & GROUP TABLES (STEP 1) */}
          {view === "Standings" && (
            <StandingsView
              divisions={activeDivisions}
              entries={activeEntries}
              fixtures={activeFixtures}
            />
          )}

          {/* TAB 8: STATS & HONORS (STEP 1) */}
          {view === "Stats" && (
            <LeaderboardsView
              divisions={activeDivisions}
              entries={activeEntries}
              fixtures={activeFixtures}
              events={activeEvents}
              players={data.players}
            />
          )}

          {/* TAB 9: INBOX / ANNOUNCEMENTS */}
          {view === "Inbox" && (
            <div className="space-y-6">
              <div className="panel-card p-6 rounded-2xl bg-card border border-border space-y-4">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Send size={18} className="text-primary" /> Broadcast Announcement
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const saved = await handleSaveAction({
                      action: "sendAnnouncement",
                      tournamentId: activeTournament.id,
                      body: form.get("body"),
                      audience: form.get("audience"),
                    });
                    if (saved) (e.target as HTMLFormElement).reset();
                  }}
                  className="space-y-4"
                >
                  <textarea
                    name="body"
                    placeholder="Type urgent match updates, pitch changes, or tournament broadcast..."
                    required
                    rows={3}
                    className="w-full p-3 rounded-xl bg-muted/40 border border-border text-foreground text-sm focus:outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <select name="audience" className="text-xs bg-muted p-2 rounded-xl border border-border text-foreground">
                      <option value="all_participants">All Participants & Fans</option>
                      <option value="coaches_only">Team Managers Only</option>
                    </select>
                    <button className="button primary text-xs px-4 py-2 inline-flex items-center gap-2">
                      <Send size={14} /> Send Broadcast
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-3">
                {data.announcements
                  .filter((a) => a.tournamentId === activeTournament?.id)
                  .map((a) => (
                    <div key={a.id} className="p-4 rounded-2xl bg-card border border-border space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">{a.audience.toUpperCase()}</span>
                        <span>{timeLabel(a.createdAt)}</span>
                      </div>
                      <p className="text-sm text-foreground">{a.body}</p>
                    </div>
                  ))}
              </div>

              <div className="panel-card p-6 rounded-2xl bg-card border border-border space-y-4">
                <div>
                  <h3 className="font-bold text-base text-foreground">Competition audit trail</h3>
                  <p className="text-xs text-muted-foreground">Registration decisions, match-state changes, shootout kicks and official result corrections are retained here.</p>
                </div>
                {data.auditLogs.filter((item) => item.tournamentId === activeTournament?.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audited changes have been recorded yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {data.auditLogs
                      .filter((item) => item.tournamentId === activeTournament?.id)
                      .slice(0, 30)
                      .map((item) => (
                        <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                          <div>
                            <strong className="text-foreground">{item.action.replaceAll("_", " ")}</strong>
                            <span className="text-muted-foreground"> · {item.entityType} · {item.actorEmail}</span>
                          </div>
                          <span className="text-muted-foreground">{timeLabel(item.createdAt)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {createOpen && <CreateTournament onClose={() => setCreateOpen(false)} onSaved={handleSaveAction} />}
      {editTarget && (
        <EditTournament
          tournament={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaveAction}
        />
      )}
      {teamOpen && <AddTeamModal divisions={activeDivisions} onClose={() => setTeamOpen(false)} onSaved={handleSaveAction} />}
      {fixtureOpen && (
        <GenerateFixturesModal divisions={activeDivisions} onClose={() => setFixtureOpen(false)} onSaved={handleSaveAction} />
      )}
      {staffTarget && (
        <AssignStaffModal
          entry={staffTarget}
          assignments={data.clubStaffAssignments.filter((assignment) => assignment.clubId === staffTarget.clubId)}
          onClose={() => setStaffTarget(null)}
          onSaved={handleSaveAction}
        />
      )}
      {refereeTarget && (
        <AssignRefereeModal
          fixture={refereeTarget}
          label={`${activeEntries.find((entry) => entry.id === refereeTarget.homeEntryId)?.teamName || "Home"} vs ${activeEntries.find((entry) => entry.id === refereeTarget.awayEntryId)?.teamName || "Away"}`}
          onClose={() => setRefereeTarget(null)}
          onSaved={handleSaveAction}
        />
      )}
      {correctionTarget && (
        <CorrectResultModal
          fixture={correctionTarget}
          label={`${activeEntries.find((entry) => entry.id === correctionTarget.homeEntryId)?.teamName || "Home"} vs ${activeEntries.find((entry) => entry.id === correctionTarget.awayEntryId)?.teamName || "Away"}`}
          onClose={() => setCorrectionTarget(null)}
          onSaved={handleSaveAction}
        />
      )}
    </div>
  );
}
