"use client";

import { FormEvent, use, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import Link from "next/link";

type Tournament = {
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
  contactName: string;
  contactPhone: string;
};
type Division = {
  id: string;
  name: string;
  format: string;
  maxTeams: number;
  registered: number;
  feePaise: number;
  feeBasis: string;
};

export default function RegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tournament, setTournament] = useState<Tournament>();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    fetch(`/api/public/tournaments/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setTournament(body.tournament);
        setDivisions(body.divisions);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Registration unavailable",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/public/tournaments/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Registration failed");
      return;
    }
    setLinked(Boolean(body.linkedToAccount));
    setDone(true);
  };
  if (loading)
    return (
      <main className="public-registration centre-state">
        <LoaderCircle className="spin" size={30} />
        <p>Loading registration…</p>
      </main>
    );
  if (error && !tournament)
    return (
      <main className="public-registration centre-state">
        <Trophy size={34} />
        <h1>Registration unavailable</h1>
        <p>{error}</p>
      </main>
    );
  if (done)
    return (
      <main className="public-registration centre-state">
        <span className="success-orb">
          <CheckCircle2 size={34} />
        </span>
        <h1>Registration submitted</h1>
        <p>
          The organizer will review your team and payment status.
          {linked
            ? " This entry is saved to your MyFootball account."
            : " You may now close this page."}
        </p>
        <Link className="button secondary" href="/discover">
          Return to tournament discovery
        </Link>
      </main>
    );
  return (
    <main className="public-registration">
      <section className="registration-hero">
        <div className="brand">
          <span className="brand-mark">
            <CircleDot size={21} />
          </span>
          <span>
            my<span>football</span>
          </span>
        </div>
        <div>
          <span className="eyebrow light">Official team registration</span>
          <h1>{tournament?.name}</h1>
          <p>
            <MapPin size={15} />
            <span>
              <strong>{tournament?.venueName}</strong>
              {tournament?.addressLine1}, {tournament?.locality},{" "}
              {tournament?.city}, {tournament?.state} – {tournament?.postalCode}
            </span>
          </p>
          {tournament && (
            <a
              className="registration-map-link"
              href={`https://www.google.com/maps/search/?api=1&query=${tournament.latitude},${tournament.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open exact location in Google Maps
            </a>
          )}
        </div>
        <span className="secure-label">
          <ShieldCheck size={15} /> Sent directly to the organizer
        </span>
      </section>
      <section className="registration-form-wrap">
        <form className="registration-form" onSubmit={submit}>
          <div>
            <span className="eyebrow">Participate</span>
            <h2>Register your team</h2>
            <p>
              The organizer will approve your entry after reviewing these
              details.
            </p>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <div className="form-grid">
            <label className="field field-wide">
              <span>Division</span>
              <select name="divisionId" required>
                {divisions.map((d) => (
                  <option
                    value={d.id}
                    disabled={d.registered >= d.maxTeams}
                    key={d.id}
                  >
                    {d.name} · {d.registered}/{d.maxTeams} teams ·{" "}
                    {d.feePaise
                      ? new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(d.feePaise / 100)
                      : "Free"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Club / academy / school</span>
              <input name="clubName" required />
            </label>
            <label className="field">
              <span>Team name</span>
              <input name="teamName" required />
            </label>
            <label className="field">
              <span>Organization type</span>
              <select name="organizationType">
                <option value="club">Club</option>
                <option value="academy">Academy</option>
                <option value="school">School</option>
                <option value="institution">Institution</option>
              </select>
            </label>
            <label className="field">
              <span>City</span>
              <input name="city" required />
            </label>
            <label className="field">
              <span>Contact person</span>
              <input name="contactName" required />
            </label>
            <label className="field">
              <span>Mobile number</span>
              <input name="contactPhone" type="tel" required />
            </label>
            <label className="field field-wide">
              <span>Note to organizer (optional)</span>
              <input name="notes" maxLength={500} />
            </label>
          </div>
          <button
            className="button primary registration-submit"
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <>
                Submit team registration <ArrowRight size={17} />
              </>
            )}
          </button>
          <small className="privacy-note">
            By submitting, you confirm that the information is accurate and may
            be used to administer this tournament.
          </small>
        </form>
      </section>
    </main>
  );
}
