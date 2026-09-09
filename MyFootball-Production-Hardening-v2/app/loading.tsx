export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header Skeleton */}
      <div className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
          <div className="w-32 h-5 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-8 rounded-xl bg-muted animate-pulse" />
          <div className="w-24 h-8 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>

      {/* Hero Skeleton */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="h-56 rounded-3xl bg-muted/60 border border-border animate-pulse p-8 space-y-4">
          <div className="w-28 h-6 rounded-full bg-muted" />
          <div className="w-72 h-10 rounded-xl bg-muted" />
          <div className="w-96 h-5 rounded-lg bg-muted" />
        </div>

        {/* Card Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-card border border-border p-5 space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="w-16 h-5 rounded bg-muted" />
                <div className="w-12 h-5 rounded bg-muted" />
              </div>
              <div className="w-40 h-6 rounded bg-muted" />
              <div className="h-20 rounded-xl bg-muted/50" />
              <div className="w-24 h-4 rounded bg-muted" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
