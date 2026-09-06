"use client";

import { FormEvent, use, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  IndianRupee,
  LoaderCircle,
  MapPin,
  Shield,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import ThemeToggle from "../../theme-toggle";
import { AppHeader } from "../../components/layout/AppHeader";
import { AppFooter } from "../../components/layout/AppFooter";
import { RadarPitchLoader } from "../../components/ui/RadarPitchLoader";

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
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("");
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
        setDivisions(body.divisions || []);
        if (body.divisions?.length) {
          setSelectedDivisionId(body.divisions[0].id);
        }
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
    const payload = Object.fromEntries(form);
    payload.divisionId = selectedDivisionId;

    const response = await fetch(`/api/public/tournaments/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
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

  const selectedDivision = divisions.find((d) => d.id === selectedDivisionId) || divisions[0];

  const formatRupees = (paise: number) => {
    if (!paise) return "Free Entry";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(paise / 100);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <RadarPitchLoader
          label="Loading Official Team Registration Portal..."
          sublabel="Connecting to Match Commissioner Registration Ledger"
          size="lg"
        />
      </main>
    );
  }

  if (error && !tournament) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md p-8 rounded-3xl bg-card border border-border text-center space-y-4 shadow-2xl">
          <Trophy size={42} className="text-rose-500 mx-auto" />
          <h1 className="text-xl font-black">Registration Unavailable</h1>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Link href="/discover" className="button secondary inline-flex items-center gap-2 text-xs">
            Return to Discovery
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 text-center space-y-5 shadow-2xl animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 size={36} />
          </div>
          <div className="space-y-1">
            <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">Entry Submitted</span>
            <h1 className="text-2xl font-black">Registration Received!</h1>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The tournament director for <strong className="text-white">{tournament?.name}</strong> has received your club entry.
            {linked
              ? " This team is automatically connected to your Coach & Team Manager Workspace."
              : " You will receive a confirmation call from the organizer."}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/coach" className="button primary">
              Open Coach Workspace
            </Link>
            <Link href={`/tournament/${tournament?.id}`} className="button secondary">
              View Public Tournament Hub
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Unified App Header */}
      <AppHeader activeRoute="register" />

      {/* Main Registration Layout */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Tournament Details & Indian Trust Card */}
        <div className="cascade-1 space-y-6 lg:col-span-1">
          <div className="interactive-card p-6 rounded-3xl bg-card border border-border space-y-4 shadow-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase">
              <ShieldCheck size={13} /> Official Registration
            </span>

            <div className="space-y-1">
              <h1 className="text-2xl font-black text-foreground">{tournament?.name}</h1>
              <p className="text-xs text-muted-foreground">Organized by {tournament?.organizedBy}</p>
            </div>

            <div className="pt-3 border-t border-border space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">{tournament?.venueName}</strong>
                  <br />
                  {tournament?.addressLine1}, {tournament?.city}, {tournament?.state} {tournament?.postalCode}
                </span>
              </div>
            </div>

            {tournament?.latitude && tournament?.longitude && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${tournament.latitude},${tournament.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 hover:underline pt-1"
              >
                <span>View Venue in Google Maps</span>
                <ExternalLink size={12} />
              </a>
            )}

            <div className="p-3.5 rounded-2xl bg-muted/50 border border-border space-y-1 text-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Organizer Contact:</span>
              <strong className="block text-foreground font-bold">{tournament?.contactName}</strong>
              <span className="text-amber-500 font-mono">{tournament?.contactPhone}</span>
            </div>
          </div>

          <div className="interactive-card p-5 rounded-3xl bg-card/60 border border-border space-y-2 text-xs text-muted-foreground shadow-sm">
            <strong className="text-foreground block font-bold">🇮🇳 UPI & Entry Guidance</strong>
            <p className="leading-relaxed">
              Once submitted, the tournament director will approve your squad entry and share official tournament UPI ID / QR code for entry fee settlement.
            </p>
          </div>
        </div>

        {/* Right Col: Registration Form */}
        <div className="cascade-2 lg:col-span-2 space-y-6">
          <form onSubmit={submit} className="p-6 sm:p-8 rounded-3xl bg-card border border-border space-y-6 shadow-xl">
            <div>
              <span className="text-xs uppercase font-bold text-amber-500 tracking-wider">Team Entry Form</span>
              <h2 className="text-2xl font-black text-foreground">Register Club / Academy Team</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Provide your official team information. The organizer will review your entry.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Division Selection Pills */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground">Select Age / Format Division *</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {divisions.map((d) => {
                  const isSelected = selectedDivisionId === d.id;
                  const isFull = d.registered >= d.maxTeams;

                  return (
                    <div
                      key={d.id}
                      onClick={() => !isFull && setSelectedDivisionId(d.id)}
                      className={`interactive-card p-3.5 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 text-foreground shadow-md shadow-amber-500/10"
                          : isFull
                          ? "bg-muted/40 border-border opacity-50 cursor-not-allowed"
                          : "bg-muted/40 border-border hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>{d.name}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatRupees(d.feePaise)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{d.format.toUpperCase()}</span>
                        <span>{d.registered} / {d.maxTeams} Teams</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Club & Team Fields */}
            <div className="cascade-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1 block">
                <span className="text-xs font-bold text-foreground">Club / Academy Name *</span>
                <input
                  name="clubName"
                  placeholder="e.g. Reliance Foundation Youth"
                  required
                  className="w-full bg-muted/60 border border-border text-foreground text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-foreground">Team Name *</span>
                <input
                  name="teamName"
                  placeholder="e.g. RFYC U17"
                  required
                  className="w-full bg-muted/60 border border-border text-foreground text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-foreground">Organization Type</span>
                <select
                  name="organizationType"
                  defaultValue="academy"
                  className="w-full bg-muted/60 border border-border text-foreground text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="academy">Professional Academy</option>
                  <option value="club">Football Club</option>
                  <option value="school">School / College</option>
                  <option value="grassroots">Grassroots Community Team</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-foreground">City / District *</span>
                <input
                  name="city"
                  placeholder="e.g. Mumbai"
                  required
                  className="w-full bg-muted/60 border border-border text-foreground text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-foreground">Head Coach / Manager Name *</span>
                <input
                  name="contactName"
                  placeholder="e.g. Sunil Fernandes"
                  required
                  className="w-full bg-muted/60 border border-border text-foreground text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-xs font-bold text-foreground">10-Digit Mobile / WhatsApp Number *</span>
                <input
                  name="contactPhone"
                  type="tel"
                  placeholder="e.g. +91 98200 12345"
                  required
                  className="w-full bg-muted/60 border border-border text-foreground text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none font-mono"
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-bold text-foreground">Notes / Squad Requirements (Optional)</span>
              <textarea
                name="notes"
                rows={2}
                maxLength={500}
                placeholder="Kit colors, arrival notes, or division inquiries..."
                className="w-full bg-muted/60 border border-border text-foreground text-xs p-3 rounded-xl focus:border-amber-500 focus:outline-none"
              />
            </label>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className="interactive-button w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 text-slate-950 font-black text-sm shadow-xl hover:opacity-95 transition flex items-center justify-center gap-2"
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <>
                    <span>Submit Team Entry ({formatRupees(selectedDivision?.feePaise || 0)})</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              By submitting this entry, you agree to comply with tournament guidelines and tournament fee schedules.
            </p>
          </form>
        </div>
      </main>

      {/* Unified App Footer */}
      <AppFooter />
    </div>
  );
}
