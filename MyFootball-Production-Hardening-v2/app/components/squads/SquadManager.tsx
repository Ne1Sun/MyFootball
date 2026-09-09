"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Check,
  Crown,
  LoaderCircle,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Division, Entry, Player, SquadMember } from "../types";
import { TacticalPitch } from "../tactics/TacticalPitch";

export function SquadManager({
  divisions,
  entries,
  players,
  squadMembers,
  onSaveAction,
}: {
  divisions: Division[];
  entries: Entry[];
  players: Player[];
  squadMembers: SquadMember[];
  onSaveAction: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [selectedEntryId, setSelectedEntryId] = useState<string>(entries[0]?.id || "");
  const [squadTab, setSquadTab] = useState<"pitch" | "list">("pitch");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [squadError, setSquadError] = useState<string | null>(null);

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) || entries[0];
  const division = divisions.find((d) => d.id === selectedEntry?.divisionId);

  // Players belonging to the selected entry's club
  const clubPlayers = useMemo(() => {
    if (!selectedEntry) return [];
    return players.filter((p) => p.clubId === selectedEntry.clubId);
  }, [players, selectedEntry]);

  // Squad assignments for this entry
  const entrySquad = useMemo(() => {
    if (!selectedEntry) return [];
    return squadMembers.filter((sm) => sm.entryId === selectedEntry.id);
  }, [squadMembers, selectedEntry]);

  const assignedPlayerIds = new Set(entrySquad.map((sm) => sm.playerId));
  const startingPlayerIds = new Set(entrySquad.filter((sm) => sm.isStarting).map((sm) => sm.playerId));

  const startingLineup = clubPlayers.filter((p) => startingPlayerIds.has(p.id));
  const substitutes = clubPlayers.filter((p) => assignedPlayerIds.has(p.id) && !startingPlayerIds.has(p.id));
  const unassignedClubPlayers = clubPlayers.filter((p) => !assignedPlayerIds.has(p.id));

  const handleAddPlayer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEntry) return;
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    const jerseyNumber = Number(form.get("jerseyNumber") || 0);
    const position = String(form.get("position") || "MID");
    const isCaptain = form.get("isCaptain") === "on";
    const dateOfBirth = String(form.get("dateOfBirth") || "");

    await onSaveAction({
      action: "addPlayer",
      clubId: selectedEntry.clubId,
      name,
      jerseyNumber,
      position,
      isCaptain,
      dateOfBirth: dateOfBirth || null,
    });
    setBusy(false);
    setShowAddPlayer(false);
  };

  const handleToggleStarting = async (playerId: string, currentStarting: boolean) => {
    if (!selectedEntry) return;
    if (!currentStarting && startingLineup.length >= 11) {
      setSquadError("Starting Limit: A team can have a maximum of 11 starting players on the pitch.");
      setTimeout(() => setSquadError(null), 4000);
      return;
    }
    setBusy(true);
    const updatedSquad = entrySquad.map((sm) => {
      if (sm.playerId === playerId) {
        return { ...sm, isStarting: !currentStarting };
      }
      return sm;
    });
    await onSaveAction({
      action: "updateSquad",
      entryId: selectedEntry.id,
      squad: updatedSquad,
    });
    setBusy(false);
  };

  const handleSwapPlayers = async (pitchId: string, benchId: string) => {
    if (!selectedEntry) return;
    setBusy(true);
    const updatedSquad = entrySquad.map((sm) => {
      if (sm.playerId === pitchId) {
        return { ...sm, isStarting: false };
      }
      if (sm.playerId === benchId) {
        return { ...sm, isStarting: true };
      }
      return sm;
    });
    await onSaveAction({
      action: "updateSquad",
      entryId: selectedEntry.id,
      squad: updatedSquad,
    });
    setBusy(false);
  };

  const handleAddToSquad = async (playerId: string) => {
    if (!selectedEntry) return;
    if (division?.maxSquadSize && entrySquad.length >= division.maxSquadSize) {
      setSquadError(`Squad Cap Reached: Maximum squad limit of ${division.maxSquadSize} players reached for this division.`);
      setTimeout(() => setSquadError(null), 4000);
      return;
    }
    setBusy(true);
    const updatedSquad = [
      ...entrySquad,
      {
        playerId,
        isStarting: entrySquad.length < 11, // Auto start if under 11
        jerseyNumber: null,
        position: null,
      },
    ];
    await onSaveAction({
      action: "updateSquad",
      entryId: selectedEntry.id,
      squad: updatedSquad,
    });
    setBusy(false);
  };

  const handleRemoveFromSquad = async (playerId: string) => {
    if (!selectedEntry) return;
    setBusy(true);
    const updatedSquad = entrySquad.filter((sm) => sm.playerId !== playerId);
    await onSaveAction({
      action: "updateSquad",
      entryId: selectedEntry.id,
      squad: updatedSquad,
    });
    setBusy(false);
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm("Are you sure you want to delete this player from the club roster?")) return;
    setBusy(true);
    await onSaveAction({
      action: "deletePlayer",
      playerId,
    });
    setBusy(false);
  };

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case "GK": return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "DEF": return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "MID": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "FWD": return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default: return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
    }
  };

  if (entries.length === 0) {
    return (
      <div className="empty-card">
        <Users size={36} />
        <h3>No Approved Teams</h3>
        <p>Approve or register teams in the Teams tab before managing player rosters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Header & Selector */}
      <div className="panel-card flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              <Shield size={24} />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Select Team Squad</span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedEntryId}
                  onChange={(e) => setSelectedEntryId(e.target.value)}
                  className="font-bold text-lg bg-transparent border-none focus:outline-none cursor-pointer text-foreground"
                >
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-popover text-popover-foreground">
                      {entry.teamName} ({entry.clubName}) — {entry.groupName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
            <span>Division: <strong className="text-foreground">{division?.name}</strong></span>
            <span>•</span>
            <span>Squad: <strong className="text-foreground">{entrySquad.length} / {division?.maxSquadSize || 18}</strong></span>
          </div>
        </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
            <button
              onClick={() => setSquadTab("pitch")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                squadTab === "pitch"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ⚽ 2D Tactical Pitch
            </button>
            <button
              onClick={() => setSquadTab("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                squadTab === "list"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📋 Roster List
            </button>
          </div>

          <button
            onClick={() => setShowAddPlayer(true)}
            className="button primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <UserPlus size={16} /> Add Player to Club
          </button>
        </div>

      {/* In-app Squad Warning / Error Banner */}
      {squadError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 shadow-xs">
          <span>{squadError}</span>
          <button
            onClick={() => setSquadError(null)}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 transition"
            aria-label="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2D Tactical Football Pitch Board View */}
      {squadTab === "pitch" && (
        <div className="panel-card p-6 rounded-3xl bg-card border border-border space-y-4">
          <TacticalPitch
            startingPlayers={startingLineup}
            benchPlayers={substitutes}
            teamName={selectedEntry?.teamName}
            isInteractive={!busy}
            onSwapPlayer={handleSwapPlayers}
            onBenchPlayer={(pitchId) => {
              void handleToggleStarting(pitchId, true);
            }}
          />
        </div>
      )}

      {/* Grid: Starting Lineup, Substitutes & Available Pool */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Starting Lineup (XI) */}
        <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="font-bold text-base text-foreground">Starting Lineup</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {startingLineup.length} Players
            </span>
          </div>

          {startingLineup.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">No starting players selected. Add players from below.</p>
          ) : (
            <div className="space-y-2.5">
              {startingLineup.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-background flex items-center justify-center font-bold text-sm text-foreground shadow-sm">
                      #{player.jerseyNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-semibold text-foreground">{player.name}</strong>
                        {player.isCaptain && <span title="Team Captain"><Crown size={13} className="text-amber-500" /></span>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStarting(player.id, true)}
                      title="Move to Bench"
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground font-medium transition"
                    >
                      Bench
                    </button>
                    <button
                      onClick={() => handleRemoveFromSquad(player.id)}
                      title="Remove from Squad"
                      className="p-1.5 text-muted-foreground hover:text-rose-500 transition"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Substitutes / Bench */}
        <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 className="font-bold text-base text-foreground">Substitutes & Bench</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
              {substitutes.length} Players
            </span>
          </div>

          {substitutes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">No bench players assigned.</p>
          ) : (
            <div className="space-y-2.5">
              {substitutes.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-background flex items-center justify-center font-bold text-sm text-foreground shadow-sm">
                      #{player.jerseyNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-semibold text-foreground">{player.name}</strong>
                        {player.isCaptain && <span title="Team Captain"><Crown size={13} className="text-amber-500" /></span>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStarting(player.id, false)}
                      title="Promote to Starting XI"
                      className="text-xs px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-medium transition"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => handleRemoveFromSquad(player.id)}
                      title="Remove from Squad"
                      className="p-1.5 text-muted-foreground hover:text-rose-500 transition"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Club Player Pool */}
        <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-muted-foreground" />
              <h3 className="font-bold text-base text-foreground">Club Player Pool</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              {clubPlayers.length} Total
            </span>
          </div>

          {unassignedClubPlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">
              All club players are currently assigned to this squad.
            </p>
          ) : (
            <div className="space-y-2.5">
              {unassignedClubPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition border border-dashed border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-background flex items-center justify-center font-bold text-sm text-muted-foreground">
                      #{player.jerseyNumber}
                    </span>
                    <div>
                      <strong className="text-sm font-semibold text-foreground">{player.name}</strong>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${getPositionColor(player.position)}`}>
                          {player.position}
                        </span>
                        {player.dateOfBirth && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            DOB: {player.dateOfBirth}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAddToSquad(player.id)}
                      title="Add to Tournament Squad"
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary font-semibold transition"
                    >
                      <Plus size={13} /> Add
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(player.id)}
                      title="Delete Player"
                      className="p-1.5 text-muted-foreground hover:text-rose-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal max-w-md">
            <div className="modal-top">
              <div>
                <span className="eyebrow">Player Registration</span>
                <h2>Add Player to Club Roster</h2>
                <p>Add player details for {selectedEntry?.clubName}.</p>
              </div>
              <button className="icon-button" onClick={() => setShowAddPlayer(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleAddPlayer}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span>Full Name</span>
                  <input name="name" placeholder="e.g. Aarav Sharma" required autoFocus />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Jersey Number</span>
                    <input name="jerseyNumber" type="number" min="1" max="99" defaultValue="10" required />
                  </label>
                  <label className="field">
                    <span>Position</span>
                    <select name="position" defaultValue="MID">
                      <option value="GK">Goalkeeper (GK)</option>
                      <option value="DEF">Defender (DEF)</option>
                      <option value="MID">Midfielder (MID)</option>
                      <option value="FWD">Forward (FWD)</option>
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Date of Birth (for age cutoff verification)</span>
                  <input name="dateOfBirth" type="date" />
                </label>

                <label className="toggle-row">
                  <div>
                    <strong>Team Captain</strong>
                    <small>Assign captain armband for match coin toss</small>
                  </div>
                  <input name="isCaptain" type="checkbox" />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setShowAddPlayer(false)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <UserCheck size={17} />} Save Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
