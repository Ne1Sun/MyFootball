"use client";

import {
  CalendarDays,
  Check,
  CircleDot,
  Compass,
  ExternalLink,
  Heart,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { ChatGPTUser } from "../chatgpt-auth";
import ThemeToggle from "../theme-toggle";

type Division = {
  id: string;
  name: string;
  format: string;
  maxTeams: number;
  feePaise: number;
};
type Tournament = {
  id: string;
  name: string;
  organizedBy: string;
  venueName: string;
  addressLine1: string;
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  startDate: string;
  durationDays: number;
  status: string;
  divisions: Division[];
  registeredTeams: number;
  approvedTeams: number;
  followed: boolean;
  myRegistrations: number;
  nextFixture?: { kickoffAt: string; pitch: number; status: string };
};

const dateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const money = (paise: number) =>
  paise
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(paise / 100)
    : "Free";

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <CircleDot size={20} />
      </span>
      <span>
        my<span>football</span>
      </span>
    </div>
  );
}

export default function DiscoverClient({
  user,
  role,
  preferredState,
  preferredCity,
}: {
  user: ChatGPTUser;
  role: string;
  preferredState: string;
  preferredCity: string;
}) {
  const [items, setItems] = useState<Tournament[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    state: preferredState,
    city: preferredCity,
    locality: "",
  });
  const [applied, setApplied] = useState(filters);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(
        Object.entries(applied).filter(([, value]) => value),
      );
      const response = await fetch(`/api/discover?${query}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body.tournaments);
      setStates(body.areas.states);
      setCities(body.areas.cities);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load tournaments",
      );
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setApplied(filters);
  };
  const follow = async (item: Tournament) => {
    const next = !item.followed;
    setItems((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, followed: next } : row,
      ),
    );
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tournamentId: item.id, follow: next }),
    });
    if (!response.ok)
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, followed: !next } : row,
        ),
      );
  };
  const clear = () => {
    const next = { search: "", state: "", city: "", locality: "" };
    setFilters(next);
    setApplied(next);
  };
  return (
    <main className="discover-page">
      <header className="discover-header">
        <Logo />
        <nav>
          <Link className="active" href="/discover">
            <Compass size={16} /> Discover
          </Link>
          <Link href="/organize">
            <ShieldCheck size={16} /> Organizer workspace
          </Link>
          <Link href="/account">
            <Settings size={16} /> Account
          </Link>
          <a href="/signout-with-chatgpt?return_to=%2Fsigned-out">Sign out</a>
        </nav>
        <ThemeToggle compact />
      </header>
      <section className="discover-hero">
        <div>
          <span className="eyebrow light">Football happening near you</span>
          <h1>
            Find your next
            <br />
            matchday.
          </h1>
          <p>
            Search verified tournament locations across India, follow
            competitions and never miss a fixture.
          </p>
          <div className="discover-hero-actions">
            <Link className="button lime-button" href="/organize">
              <Plus size={17} /> Create a tournament
            </Link>
            <a className="button ghost-button" href="#tournaments">
              <Users size={17} /> Register my team
            </a>
          </div>
        </div>
        <div className="fan-greeting">
          <span>
            {user.displayName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </span>
          <div>
            <small>{role === "fan" ? "DISCOVER HOME" : "ORGANIZER HOME"}</small>
            <strong>{user.displayName}</strong>
            <p>
              {preferredCity || "All India"}
              {preferredState ? `, ${preferredState}` : ""}
            </p>
          </div>
        </div>
      </section>
      <form className="discovery-search" onSubmit={submit}>
        <label>
          <Search size={18} />
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            placeholder="Tournament, venue or PIN code"
          />
        </label>
        <select
          value={filters.state}
          onChange={(event) =>
            setFilters({ ...filters, state: event.target.value })
          }
        >
          <option value="">All states</option>
          {states.map((state) => (
            <option key={state}>{state}</option>
          ))}
        </select>
        <select
          value={filters.city}
          onChange={(event) =>
            setFilters({ ...filters, city: event.target.value })
          }
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city}>{city}</option>
          ))}
        </select>
        <input
          value={filters.locality}
          onChange={(event) =>
            setFilters({ ...filters, locality: event.target.value })
          }
          placeholder="Locality / area"
        />
        <button className="button primary">Search area</button>
      </form>
      <section className="discover-content" id="tournaments">
        <div className="discover-heading">
          <div>
            <span className="eyebrow">Tournament discovery</span>
            <h2>
              {loading
                ? "Searching…"
                : `${items.length} tournament${items.length === 1 ? "" : "s"} found`}
            </h2>
          </div>
          {Object.values(applied).some(Boolean) && (
            <button onClick={clear}>Clear filters</button>
          )}
        </div>
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="discover-loading">
            <LoaderCircle className="spin" size={26} />
          </div>
        ) : items.length ? (
          <div className="discover-grid">
            {items.map((item) => (
              <article className="discover-card" key={item.id}>
                <div className="discover-card-cover">
                  <span
                    className={`status status-${item.status === "live" ? "live" : "registration"}`}
                  >
                    <i />
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <button
                    className={
                      item.followed ? "follow-button followed" : "follow-button"
                    }
                    onClick={() => void follow(item)}
                    aria-label={
                      item.followed
                        ? "Unfollow tournament"
                        : "Follow tournament"
                    }
                  >
                    <Heart
                      size={18}
                      fill={item.followed ? "currentColor" : "none"}
                    />
                  </button>
                  <Trophy size={42} />
                </div>
                <div className="discover-card-body">
                  <span className="eyebrow">{item.organizedBy}</span>
                  <h3>{item.name}</h3>
                  <p className="exact-location">
                    <MapPin size={16} />
                    <span>
                      <strong>{item.venueName}</strong>
                      {item.addressLine1}, {item.locality}, {item.city},{" "}
                      {item.state} – {item.postalCode}
                    </span>
                  </p>
                  <div className="discover-tags">
                    {item.divisions.map((division) => (
                      <span key={division.id}>{division.name}</span>
                    ))}
                  </div>
                  <div className="discover-facts">
                    <span>
                      <CalendarDays size={15} />
                      <div>
                        <small>Starts</small>
                        <strong>{dateLabel(item.startDate)}</strong>
                      </div>
                    </span>
                    <span>
                      <Users size={15} />
                      <div>
                        <small>Teams</small>
                        <strong>{item.registeredTeams}</strong>
                      </div>
                    </span>
                    <span>
                      <CircleDot size={15} />
                      <div>
                        <small>Entry</small>
                        <strong>
                          {item.divisions.length
                            ? money(
                                Math.min(
                                  ...item.divisions.map((d) => d.feePaise),
                                ),
                              )
                            : "—"}
                        </strong>
                      </div>
                    </span>
                  </div>
                  <div className="discover-actions">
                    <a
                      className="button secondary"
                      href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={15} /> Open map
                    </a>
                    {item.status === "registration_open" && (
                      <Link
                        className="button primary"
                        href={`/register/${item.id}`}
                      >
                        {item.myRegistrations
                          ? "Register another team"
                          : "Register my team"}{" "}
                        <ExternalLink size={15} />
                      </Link>
                    )}
                  </div>
                  {item.followed && (
                    <div className="following-note">
                      <Check size={14} /> Following this tournament
                    </div>
                  )}
                  {item.myRegistrations > 0 && (
                    <div className="registered-note">
                      <Check size={14} /> {item.myRegistrations} team
                      {item.myRegistrations === 1 ? "" : "s"} registered from
                      this account
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="discover-empty">
            <Compass size={34} />
            <h3>No tournaments found in this area</h3>
            <p>Try removing a filter or searching a nearby city.</p>
            <button className="button secondary" onClick={clear}>
              Show all tournaments
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
