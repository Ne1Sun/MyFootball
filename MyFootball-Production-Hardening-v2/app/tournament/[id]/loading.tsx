export default function TournamentLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header Placeholder */}
      <div className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
          <div className="w-36 h-5 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="w-24 h-8 rounded-xl bg-muted animate-pulse" />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Tournament Hero Card Skeleton */}
        <div className="h-64 rounded-3xl bg-muted/60 border border-border p-8 space-y-4 animate-pulse">
          <div className="flex justify-between">
            <div className="w-24 h-6 rounded-full bg-muted" />
            <div className="w-32 h-8 rounded-xl bg-muted" />
          </div>
          <div className="w-80 h-10 rounded-xl bg-muted" />
          <div className="w-48 h-5 rounded-lg bg-muted" />
        </div>

        {/* Division & Navigation Tabs Skeleton */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <div key={t} className="w-28 h-10 rounded-xl bg-card border border-border animate-pulse shrink-0" />
          ))}
        </div>

        {/* Fixtures/Bracket/Standings Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((f) => (
            <div key={f} className="h-36 rounded-2xl bg-card border border-border p-5 space-y-3 animate-pulse">
              <div className="flex justify-between">
                <div className="w-20 h-4 rounded bg-muted" />
                <div className="w-16 h-4 rounded bg-muted" />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="w-32 h-5 rounded bg-muted" />
                <div className="w-12 h-6 rounded bg-muted" />
                <div className="w-32 h-5 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
