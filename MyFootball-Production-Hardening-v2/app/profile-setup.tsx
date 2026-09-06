"use client";

import {
  ArrowRight,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { FormEvent, useState } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";
import ThemeToggle from "./theme-toggle";

export default function ProfileSetup({
  user,
  currentRole = "fan",
  preferredState = "",
  preferredCity = "",
  editing = false,
}: {
  user: ChatGPTUser;
  currentRole?: string;
  preferredState?: string;
  preferredCity?: string;
  editing?: boolean;
}) {
  const [role, setRole] = useState<"fan" | "organizer">(
    currentRole === "organizer" ? "organizer" : "fan",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "setProfile",
        role,
        preferredState: form.get("preferredState"),
        preferredCity: form.get("preferredCity"),
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Could not save profile");
      return;
    }
    window.location.href = role === "fan" ? "/discover" : "/";
  };
  return (
    <main className="setup-screen">
      <div className="setup-top">
        <div className="brand">
          <span className="brand-mark">
            <Trophy size={18} />
          </span>
          <span>
            my<span>football</span>
          </span>
        </div>
        <ThemeToggle />
      </div>
      <form className="setup-card" onSubmit={submit}>
        <span className="eyebrow">
          {editing ? "Account settings" : `Welcome, ${user.displayName}`}
        </span>
        <h1>
          {editing
            ? "Choose your starting screen"
            : "Where should MyFootball start?"}
        </h1>
        <p>
          Every account can discover tournaments, register a team and run a
          complete tournament. This only chooses the screen you see first.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <div className="role-grid">
          <button
            type="button"
            className={role === "fan" ? "role-choice selected" : "role-choice"}
            onClick={() => setRole("fan")}
          >
            <span>
              <Users size={24} />
            </span>
            <strong>Discover first</strong>
            <small>
              Browse nearby tournaments and register your team. You can still
              open the organizer workspace at any time.
            </small>
          </button>
          <button
            type="button"
            className={
              role === "organizer" ? "role-choice selected" : "role-choice"
            }
            onClick={() => setRole("organizer")}
          >
            <span>
              <ShieldCheck size={24} />
            </span>
            <strong>Organize first</strong>
            <small>
              Create tournaments, register teams, generate fixtures and run
              matchday.
            </small>
          </button>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Your state</span>
            <input
              name="preferredState"
              defaultValue={preferredState}
              placeholder="e.g. Maharashtra"
              required={role === "fan"}
            />
          </label>
          <label className="field">
            <span>Your city / area</span>
            <input
              name="preferredCity"
              defaultValue={preferredCity}
              placeholder="e.g. Mumbai"
              required={role === "fan"}
            />
          </label>
        </div>
        <div className="setup-note">
          <MapPin size={16} />
          <span>
            This helps prioritize tournaments near you. You can search anywhere
            in India later.
          </span>
        </div>
        <button className="button primary setup-submit" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <>
              {editing ? "Save account" : "Create account"}{" "}
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
    </main>
  );
}
