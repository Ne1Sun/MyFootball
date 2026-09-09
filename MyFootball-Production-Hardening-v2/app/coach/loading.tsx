export default function CoachLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <div className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
          <div className="w-32 h-5 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="w-28 h-8 rounded-xl bg-muted animate-pulse" />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        <div className="h-32 rounded-3xl bg-muted/60 border border-border p-6 space-y-3 animate-pulse">
          <div className="w-48 h-7 rounded-xl bg-muted" />
          <div className="w-72 h-4 rounded-lg bg-muted" />
        </div>

        {/* Pitch / Lineup Skeleton */}
        <div className="h-96 rounded-3xl bg-card border border-border p-6 animate-pulse flex items-center justify-center">
          <div className="w-64 h-64 rounded-2xl bg-muted/40 border border-dashed border-border" />
        </div>
      </main>
    </div>
  );
}
