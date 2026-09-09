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
  FileText,
  Globe,
  IndianRupee,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Menu,
  MessageSquareText,
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
import type { AppData, Club, Division, Entry, Fixture, MatchEvent, Player, SquadMember, TeamFormat, Tournament } from "./components/types";
import { SquadManager } from "./components/squads/SquadManager";
import { LiveMatchConsole } from "./components/matchday/LiveMatchConsole";
import { KnockoutBracket } from "./components/brackets/KnockoutBracket";
import { FeeReceiptModal } from "./components/payments/FeeReceiptModal";
import { LeaderboardsView } from "./components/stats/LeaderboardsView";
import { StandingsView } from "./components/standings/StandingsView";
import {
  getFormatDurationPresets,
  getRecommendedHalftime,
  validateMatchDuration,
} from "./lib/competition";

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
  clubs: [],
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
const dateLabel = (date?: string | null) => {
  if (!date || typeof date !== "string") return "TBD";
  const raw = date.includes("T") ? date.split("T")[0] : date;
  const parts = raw.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  const parsed = new Date(date);
  return isNaN(parsed.getTime())
    ? date || "TBD"
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const timeLabel = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

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
  onSaved: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [ages, setAges] = useState(["U-17"]);
  const [teamFormat, setTeamFormat] = useState<TeamFormat>("11v11");
  const [maxSquadSize, setMaxSquadSize] = useState(18);
  const [matchDuration, setMatchDuration] = useState<number>(90);
  const [durationInput, setDurationInput] = useState<string>("90");
  const [durationError, setDurationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState({ latitude: "", longitude: "" });

  const handleFormatSelect = (format: TeamFormat) => {
    setTeamFormat(format);
    if (format === "5v5") {
      setMaxSquadSize(10);
      setMatchDuration(40);
      setDurationInput("40");
      setDurationError(null);
    } else if (format === "7v7") {
      setMaxSquadSize(14);
      setMatchDuration(50);
      setDurationInput("50");
      setDurationError(null);
    } else {
      setMaxSquadSize(18);
      setMatchDuration(90);
      setDurationInput("90");
      setDurationError(null);
    }
  };

  const handleDurationChange = (raw: string) => {
    setDurationInput(raw);
    if (!raw.trim()) {
      setDurationError("Match duration is required.");
      return;
    }
    const val = validateMatchDuration(raw, matchDuration);
    if (!val.valid) {
      setDurationError(val.error || "Invalid match duration.");
    } else {
      setDurationError(null);
      setMatchDuration(val.value);
    }
  };
  const handleSelectPreset = (preset: number) => {
    setMatchDuration(preset);
    setDurationInput(String(preset));
    setDurationError(null);
  };
  const [geoStatus, setGeoStatus] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const usePosition = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation is not supported by your browser.");
      return;
    }
    setGeoStatus("Detecting coordinates...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setGeoStatus("Coordinates detected successfully!");
        setTimeout(() => setGeoStatus(""), 3000);
      },
      (error) => {
        setGeoStatus(error.message || "Location access denied. Centroid will be auto-resolved from city.");
        setTimeout(() => setGeoStatus(""), 4000);
      },
      { timeout: 8000 }
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const val = validateMatchDuration(durationInput, matchDuration);
    if (!val.valid) {
      setDurationError(val.error || "Please enter an even natural number.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const form = new FormData(event.currentTarget);
      const halfTimeBreak = getRecommendedHalftime(val.value);
      await onSaved({
        action: "createTournament",
        name: form.get("name"),
        teamFormat: form.get("teamFormat") || teamFormat,
        matchDurationMinutes: val.value,
        halfTimeBreakMinutes: halfTimeBreak,
        organizedBy: form.get("organizedBy"),
        city: form.get("city"),
        venueName: form.get("venueName"),
        addressLine1: form.get("addressLine1"),
        locality: form.get("locality"),
        state: form.get("state"),
        postalCode: form.get("postalCode"),
        latitude: coords.latitude || form.get("latitude"),
        longitude: coords.longitude || form.get("longitude"),
        startDate: form.get("startDate"),
        durationDays: form.get("durationDays"),
        contactName: form.get("contactName"),
        contactPhone: form.get("contactPhone"),
        format: form.get("format"),
        maxTeams: form.get("maxTeams"),
        maxSquadSize: form.get("maxSquadSize") || maxSquadSize,
        feeRupees: form.get("feeRupees"),
        ageGroups: ages,
        openRegistration: form.get("openRegistration") === "on",
        requirePlayers: form.get("requirePlayers") === "on",
        requireDocuments: form.get("requireDocuments") === "on",
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create tournament.";
      setFormError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Create a tournament" subtitle="Every field below is saved to your organizer account." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="form-grid">
            {formError && (
              <div className="field field-wide p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}
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
              <input name="postalCode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="400001" />
            </label>
            <label className="field">
              <span>Latitude (Optional)</span>
              <input
                name="latitude"
                value={coords.latitude}
                onChange={(event) => setCoords({ ...coords, latitude: event.target.value })}
                placeholder="Auto-detected if blank"
              />
            </label>
            <label className="field">
              <span>Longitude (Optional)</span>
              <input
                name="longitude"
                value={coords.longitude}
                onChange={(event) => setCoords({ ...coords, longitude: event.target.value })}
                placeholder="Auto-detected if blank"
              />
            </label>
            <div className="field-wide flex items-center justify-between gap-2">
              <button className="location-helper flex-1" type="button" onClick={usePosition}>
                <MapPin size={15} /> Use my current coordinates
              </button>
              {geoStatus && <span className="text-[11px] text-muted-foreground">{geoStatus}</span>}
            </div>
            <label className="field">
              <span>Start date</span>
              <input name="startDate" type="date" required />
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
            {/* Match Playing Format (5v5 / 7v7 / 11v11) */}
            <div className="field field-wide space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Match Playing Format *</span>
                <span className="text-[11px] font-medium text-muted-foreground">Select team size on pitch</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: "5v5",
                    icon: "⚡",
                    title: "5v5 Turf / Futsal",
                    desc: "5 Starters (1 GK + 4 Outfield) • 30–40m match",
                    badge: "Turf / Box",
                  },
                  {
                    id: "7v7",
                    icon: "🌱",
                    title: "7v7 Grassroots",
                    desc: "7 Starters (1 GK + 6 Outfield) • 50m match",
                    badge: "Mini Pitch",
                  },
                  {
                    id: "11v11",
                    icon: "🏆",
                    title: "11v11 Full Pitch",
                    desc: "11 Starters (1 GK + 10 Outfield) • 90m match",
                    badge: "Standard",
                  },
                ].map((f) => {
                  const active = teamFormat === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFormatSelect(f.id as TeamFormat)}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between space-y-1.5 ${
                        active
                          ? "bg-amber-500/15 border-amber-500 shadow-sm text-foreground ring-1 ring-amber-500/50"
                          : "bg-muted/40 border-border hover:border-border/80 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-base">{f.icon}</span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                            active
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {f.badge}
                        </span>
                      </div>
                      <div>
                        <strong className="text-xs font-bold block text-foreground">{f.title}</strong>
                        <span className="text-[11px] leading-tight block text-muted-foreground">{f.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="teamFormat" value={teamFormat} />
            </div>

            {/* Custom Match Duration (Divisible cleanly by 2 in natural numbers) */}
            <div className="field field-wide space-y-2 p-3.5 rounded-2xl border border-border/80 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <Clock3 size={15} className="text-amber-500" />
                  <span className="text-xs font-bold text-foreground">Custom Match Duration (Minutes) *</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  Must be divisible cleanly by 2 (natural numbers)
                </span>
              </div>

              {/* Quick Presets for this format */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground font-semibold">Recommended presets for {teamFormat}:</span>
                <div className="flex flex-wrap gap-2">
                  {getFormatDurationPresets(teamFormat).map((preset) => {
                    const active = Number(durationInput) === preset && !durationError;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                          active
                            ? "bg-amber-500 text-black border-amber-500 shadow-sm"
                            : "bg-background hover:bg-muted text-foreground border-border"
                        }`}
                      >
                        {preset} mins <span className={`text-[10px] font-normal ${active ? "text-black/80" : "text-muted-foreground"}`}>({preset / 2}m + {preset / 2}m)</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom number input with step 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Enter custom match time (Minutes):
                  </label>
                  <div className="relative">
                    <input
                      name="matchDurationMinutes"
                      type="number"
                      step="2"
                      min="10"
                      max="180"
                      value={durationInput}
                      onChange={(e) => handleDurationChange(e.target.value)}
                      placeholder="e.g. 30, 40, 60, 90"
                      className={`w-full px-3 py-2 text-sm rounded-xl border bg-background text-foreground font-semibold ${
                        durationError ? "border-rose-500 ring-1 ring-rose-500/50" : "border-border"
                      }`}
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">mins</span>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  {!durationError ? (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Check size={13} />
                        <span>2 equal halves of {matchDuration / 2} minutes each</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Halftime break: {getRecommendedHalftime(matchDuration)} mins • Extra time supported
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-1.5">
                      <span className="text-sm leading-none mt-0.5">⚠️</span>
                      <span className="leading-tight text-[11px] font-medium">{durationError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <label className="field">
              <span>Competition Bracket Structure</span>
              <select name="format" defaultValue="group_knockout">
                <option value="group_knockout">Group Stage + Knockout Bracket</option>
                <option value="round_robin">Round Robin League</option>
                <option value="knockout">Pure Knockout Cup</option>
              </select>
            </label>
            <label className="field">
              <span>Maximum teams per division</span>
              <select name="maxTeams" defaultValue="16">
                <option>8</option>
                <option>12</option>
                <option>16</option>
                <option>24</option>
                <option>32</option>
              </select>
            </label>
            <label className="field">
              <span>Maximum squad size</span>
              <input
                name="maxSquadSize"
                type="number"
                min="5"
                max="50"
                value={maxSquadSize}
                onChange={(e) => setMaxSquadSize(Number(e.target.value))}
              />
              <small className="text-[11px] text-muted-foreground mt-0.5 block">
                {teamFormat === "5v5"
                  ? "Recommended: 8–12 players (5 starters)"
                  : teamFormat === "7v7"
                  ? "Recommended: 10–14 players (7 starters)"
                  : "Recommended: 16–25 players (11 starters)"}
              </small>
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
                <strong>Collect player lists</strong>
                <small>Enable squad rosters and player stats tracking</small>
              </div>
              <input name="requirePlayers" type="checkbox" defaultChecked />
            </label>
            <label className="toggle-row field-wide">
              <div>
                <strong>Open public team registration</strong>
                <small>Publish competition immediately on Discover and allow clubs to register</small>
              </div>
              <input name="openRegistration" type="checkbox" defaultChecked />
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

function AddTeamModal({
  divisions,
  clubs,
  onClose,
  onSaved,
}: {
  divisions: Division[];
  clubs?: Club[];
  onClose: () => void;
  onSaved: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [clubName, setClubName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [organizationType, setOrganizationType] = useState("academy");
  const [city, setCity] = useState("Mumbai");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const handleSelectClub = (clubId: string) => {
    if (!clubId) {
      setClubName("");
      setOrganizationType("academy");
      setCity("Mumbai");
      setContactName("");
      setContactPhone("");
      return;
    }
    const c = clubs?.find((item) => item.id === clubId);
    if (c) {
      setClubName(c.name);
      setOrganizationType(c.organizationType || "academy");
      setCity(c.city || "Mumbai");
      setContactName(c.contactName || "");
      setContactPhone(c.contactPhone || "");
      if (!teamName) {
        setTeamName(`${c.name} U-17`);
      }
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    await onSaved({
      action: "addTeam",
      divisionId: form.get("divisionId"),
      clubName: clubName || form.get("clubName"),
      teamName: teamName || form.get("teamName"),
      organizationType: organizationType || form.get("organizationType"),
      city: city || form.get("city"),
      contactName: contactName || form.get("contactName"),
      contactPhone: contactPhone || form.get("contactPhone"),
      paymentStatus: form.get("paymentStatus"),
      groupName: form.get("groupName"),
      approved: form.get("approved") === "on",
    });
    setBusy(false);
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

            {clubs && clubs.length > 0 && (
              <label className="field field-wide">
                <span>Quick-Select Registered Organization / Club</span>
                <select onChange={(e) => handleSelectClub(e.target.value)} defaultValue="">
                  <option value="">-- Choose from registered Indian academies / clubs --</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city}) [{c.organizationType.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>Club / Academy Name</span>
              <input
                name="clubName"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Reliance Foundation Young Champs"
                required
              />
            </label>
            <label className="field">
              <span>Team Name</span>
              <input
                name="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="RFYC U17"
                required
              />
            </label>
            <label className="field">
              <span>Organization Type</span>
              <select
                name="organizationType"
                value={organizationType}
                onChange={(e) => setOrganizationType(e.target.value)}
              >
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
              <input
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Mumbai"
              />
            </label>
            <label className="field">
              <span>Contact Person</span>
              <input
                name="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Mobile Number</span>
              <input
                name="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
              />
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
  onSaved: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    await onSaved({
      action: "generateFixtures",
      divisionId: form.get("divisionId"),
      mode: form.get("mode"),
      startDate: form.get("startDate"),
      startTime: form.get("startTime"),
      pitches: form.get("pitches"),
      slotMinutes: form.get("slotMinutes"),
    });
    setBusy(false);
  };
  return (
    <Modal title="Generate Fixtures & Brackets" subtitle="Approved teams are scheduled with pitch and bracket slots." onClose={onClose}>
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
              <span>Tournament Format</span>
              <select name="mode" defaultValue="group_knockout">
                <option value="group_knockout">Group Stage + Knockout Bracket</option>
                <option value="knockout">Pure Knockout Bracket</option>
                <option value="round_robin">Round Robin League</option>
              </select>
            </label>
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
            <div className="smart-note field-wide">
              <Sparkles size={18} />
              <div>
                <strong>Automatic Knockout Tree Generation</strong>
                <p>Generates Group stage fixtures and links Semi-Finals, 3rd Place, and Grand Finals.</p>
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
  const [teamOpen, setTeamOpen] = useState(false);
  const [fixtureOpen, setFixtureOpen] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState<Entry | null>(null);

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
      setError("");
      const res = await fetch("/api/app");
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to load tournament data");
      }
      const json = await res.json();
      setData(json);
      if (json.tournaments?.length) {
        setSelectedId((prev) => (json.tournaments.some((t: Tournament) => t.id === prev) ? prev : json.tournaments[0].id));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/app");
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || "Failed to load tournament data");
        }
        const json = await res.json();
        if (mounted) {
          setData(json);
          if (json.tournaments?.length) {
            setSelectedId((prev) => prev || json.tournaments[0].id);
          }
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "An error occurred");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

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
      setToast("Operation updated successfully!");
      setTimeout(() => setToast(""), 4000);
      await refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error performing action";
      setError(msg);
      setTimeout(() => setError(""), 6000);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const [activeMatchdayFixtureId, setActiveMatchdayFixtureId] = useState<string>("");

  const handleOpenMatchday = (fixtureId: string) => {
    setActiveMatchdayFixtureId(fixtureId);
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
          <button
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-muted-foreground hover:text-foreground rounded-lg"
            onClick={() => setSidebar(false)}
            aria-label="Close navigation sidebar"
          >
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
            {data.tournaments.length === 0 && (
              <option value="">No Competitions Found</option>
            )}
            {data.tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} [{t.teamFormat || "11v11"}] ({t.city})
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
                onClick={() => {
                  setView(item.label);
                  setSidebar(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
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
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg bg-muted" onClick={() => setSidebar(true)}>
              <Menu size={18} />
            </button>
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Organizer Hub</span>
              <h1 className="text-lg font-extrabold text-foreground flex items-center gap-2 flex-wrap">
                <span>{activeTournament?.name || "MyFootball India"}</span>
                {activeTournament && (
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                    activeTournament.teamFormat === "5v5"
                      ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                      : activeTournament.teamFormat === "7v7"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  }`}>
                    {activeTournament.teamFormat === "5v5" ? "⚡ 5v5 Turf" : activeTournament.teamFormat === "7v7" ? "🌱 7v7 Grassroots" : "🏆 11v11 Full"}
                  </span>
                )}
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
            <div className="flex items-center gap-2 flex-wrap">
              <span>{error}</span>
              <button
                type="button"
                onClick={refreshData}
                className="underline hover:opacity-80 font-bold ml-1 cursor-pointer"
              >
                Retry
              </button>
            </div>
            <button onClick={() => setError("")} className="p-1 hover:bg-rose-500/20 rounded">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* TAB 1: OVERVIEW */}
          {view === "Overview" && (
            !activeTournament ? (
              <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-4 shadow-sm max-w-xl mx-auto my-12">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold mx-auto">
                  <Trophy size={28} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-foreground">No Competition Selected</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Select a tournament from the sidebar, or create a brand-new competition to inspect matchdays, schedules, brackets, and standings.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="button primary inline-flex items-center gap-2 text-xs px-4 py-2.5"
                  >
                    <Plus size={15} /> Create Tournament
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("Tournaments")}
                    className="button secondary inline-flex items-center gap-2 text-xs px-4 py-2.5"
                  >
                    <Trophy size={15} className="text-primary" /> View Tournaments Tab
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Tournament Hero Banner */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-8 border border-emerald-500/20 shadow-xl">
                  <div className="relative z-10 space-y-4 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE COMPETITION HUB
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight">{activeTournament.name}</h2>
                    <p className="text-slate-300 text-sm sm:text-base">
                      {activeTournament.venueName}, {activeTournament.locality}, {activeTournament.city} • {activeTournament.durationDays} Days Event
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
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
            )
          )}

          {/* TAB 2: TOURNAMENTS */}
          {view === "Tournaments" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">Your Tournaments & Organizations</h2>
                  <p className="text-xs text-muted-foreground">Manage tournament operations, playing formats, and host organizations.</p>
                </div>
                <button onClick={() => setCreateOpen(true)} className="button primary inline-flex items-center gap-2 text-sm">
                  <Plus size={16} /> Create Tournament
                </button>
              </div>

              {data.tournaments.length === 0 ? (
                <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-4 shadow-sm max-w-xl mx-auto my-8">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold mx-auto">
                    <Trophy size={28} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-foreground">No Competitions Created Yet</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      You haven&apos;t hosted any tournaments under this organizer identity. Create a brand-new grassroots tournament or load official demonstration tournaments.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="button primary inline-flex items-center gap-2 text-xs px-4 py-2.5"
                    >
                      <Plus size={15} /> Create Tournament
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleSaveAction({ action: "seedDemoTournaments" });
                        await refreshData();
                      }}
                      className="button secondary inline-flex items-center gap-2 text-xs px-4 py-2.5"
                    >
                      <Sparkles size={15} className="text-amber-400" /> Load Demo Competitions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.tournaments.map((t) => {
                    const isSelected = (activeTournament?.id === t.id);
                    const tDivisions = data.divisions.filter((d) => d.tournamentId === t.id);
                    const tDivIds = new Set(tDivisions.map((d) => d.id));
                    const tEntries = data.entries.filter((e) => tDivIds.has(e.divisionId));
                    return (
                      <div
                        key={t.id}
                        className={`panel-card p-6 rounded-2xl bg-card border transition space-y-4 shadow-sm ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 shadow-md bg-gradient-to-b from-primary/5 to-transparent"
                            : "border-border hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs">
                              {(t.status || "DRAFT").replace("_", " ").toUpperCase()}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                              t.teamFormat === "5v5"
                                ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                                : t.teamFormat === "7v7"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            }`}>
                              {t.teamFormat === "5v5" ? "⚡ 5v5 Turf" : t.teamFormat === "7v7" ? "🌱 7v7 Grassroots" : "🏆 11v11 Full"}
                            </span>
                          </div>
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ACTIVE COMPETITION
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Starts {dateLabel(t.startDate)}</span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-black text-xl text-foreground">{t.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Organized by <strong className="text-foreground">{t.organizedBy || "Grassroots Federation"}</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="px-2 py-1 rounded-lg bg-muted/60 border border-border">
                            🏆 {tDivisions.length} {tDivisions.length === 1 ? "Division" : "Divisions"}
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-muted/60 border border-border">
                            🛡️ {tEntries.length} {tEntries.length === 1 ? "Team Registered" : "Teams Registered"}
                          </span>
                          <span className="px-2 py-1 rounded-lg bg-muted/60 border border-border">
                            ⏱️ {t.matchDurationMinutes || 90} Mins
                          </span>
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

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(t.id);
                              }}
                              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition ${
                                isSelected
                                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                  : "button secondary"
                              }`}
                            >
                              {isSelected ? "Active Competition" : "Set Active"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(t.id);
                                setView("Overview");
                              }}
                              className="button secondary text-xs px-3 py-1.5"
                            >
                              Open Hub
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/tournament/${t.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-muted-foreground hover:text-primary transition rounded-lg hover:bg-muted"
                              title="Open Public Showcase"
                            >
                              <Globe size={16} />
                            </a>
                            <button
                              type="button"
                              onClick={async () => {
                                if (t.id.startsWith("tourney-")) {
                                  alert("System benchmark tournaments are protected and cannot be deleted.");
                                  return;
                                }
                                if (confirm(`Delete tournament "${t.name}"?`)) {
                                  await handleSaveAction({ action: "deleteTournament", tournamentId: t.id });
                                  if (selectedId === t.id) {
                                    const remaining = data.tournaments.filter((item) => item.id !== t.id);
                                    setSelectedId(remaining.length ? remaining[0].id : "");
                                  }
                                }
                              }}
                              className="p-2 text-muted-foreground hover:text-rose-500 transition rounded-lg hover:bg-muted"
                              title={t.id.startsWith("tourney-") ? "Benchmark tournament is protected" : "Delete Tournament"}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                        <td className="py-3 px-3 font-semibold text-foreground">{entry.groupName}</td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {entry.contactName}
                          <div className="font-mono text-[10px]">{entry.contactPhone}</div>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={async () => {
                              const nextStatus =
                                entry.paymentStatus === "paid"
                                  ? "waived"
                                  : entry.paymentStatus === "waived"
                                  ? "unpaid"
                                  : "paid";
                              await handleSaveAction({
                                action: "updateEntry",
                                entryId: entry.id,
                                paymentStatus: nextStatus,
                              });
                            }}
                            title="Click to toggle payment status (paid / waived / unpaid)"
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase transition hover:opacity-80 cursor-pointer ${
                              entry.paymentStatus === "paid"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : entry.paymentStatus === "waived"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {entry.paymentStatus}
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                              entry.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-500/15 text-slate-400"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setReceiptEntry(entry)}
                              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold transition flex items-center gap-1"
                              title="Print or view official digital fee receipt"
                            >
                              <FileText size={13} className="text-amber-400" />
                              Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeTournament) {
                                  setSelectedId(activeTournament.id);
                                }
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
              divisions={activeDivisions}
              entries={activeEntries}
              fixtures={activeFixtures}
              events={activeEvents}
              players={data.players}
              squadMembers={data.squadMembers}
              initialFixtureId={activeMatchdayFixtureId}
              onSaveAction={handleSaveAction}
            />
          )}

          {/* TAB 7: STANDINGS & GROUP TABLES (STEP 1) */}
          {view === "Standings" && (
            <StandingsView
              divisions={activeDivisions}
              entries={activeEntries}
              fixtures={activeFixtures}
              events={activeEvents}
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
                    if (!activeTournament) {
                      setError("No active tournament selected to broadcast announcements.");
                      return;
                    }
                    const form = new FormData(e.currentTarget);
                    await handleSaveAction({
                      action: "sendAnnouncement",
                      tournamentId: activeTournament.id,
                      body: form.get("body"),
                      audience: form.get("audience"),
                    });
                    (e.target as HTMLFormElement).reset();
                  }}
                  className="space-y-4"
                >
                  <textarea
                    name="body"
                    placeholder="Type urgent match updates, pitch changes, or tournament broadcast..."
                    required
                    rows={3}
                    className="w-full p-3 rounded-xl bg-muted/40 border border-border text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {createOpen && <CreateTournament onClose={() => setCreateOpen(false)} onSaved={handleSaveAction} />}
      {teamOpen && <AddTeamModal divisions={activeDivisions} clubs={data.clubs} onClose={() => setTeamOpen(false)} onSaved={handleSaveAction} />}
      {fixtureOpen && (
        <GenerateFixturesModal divisions={activeDivisions} onClose={() => setFixtureOpen(false)} onSaved={handleSaveAction} />
      )}
      {receiptEntry && activeTournament && (
        <FeeReceiptModal
          entry={receiptEntry}
          tournament={activeTournament}
          divisionName={activeDivisions.find((d) => d.id === receiptEntry.divisionId)?.name || "Division"}
          onClose={() => setReceiptEntry(null)}
          onUpdatePaymentStatus={async (entryId, newStatus) => {
            await handleSaveAction({
              action: "updateEntry",
              entryId,
              paymentStatus: newStatus,
            });
            setReceiptEntry((prev: any) => (prev ? { ...prev, paymentStatus: newStatus } : null));
          }}
        />
      )}
    </div>
  );
}
