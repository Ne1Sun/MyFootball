"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-2xl space-y-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500">
          <AlertTriangle size={28} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while processing your request. Our technical team has been notified.
          </p>
          {error?.message && (
            <div className="text-xs font-mono bg-muted/60 p-3 rounded-xl text-muted-foreground text-left overflow-x-auto max-h-24">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.975] transition"
          >
            <RotateCcw size={16} /> Try Again
          </button>
          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.975] transition border border-border"
          >
            <Home size={16} /> Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
