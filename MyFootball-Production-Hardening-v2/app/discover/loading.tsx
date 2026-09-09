export default function DiscoverLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <div className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
          <div className="w-40 h-5 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="w-24 h-8 rounded-xl bg-muted animate-pulse" />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="h-44 rounded-3xl bg-muted/60 border border-border p-8 space-y-3 animate-pulse">
          <div className="w-64 h-8 rounded-xl bg-muted" />
          <div className="w-96 h-4 rounded-lg bg-muted" />
        </div>

        {/* Discovery Filter Skeletons */}
        <div className="flex gap-2 pb-2 overflow-x-auto">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="w-24 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
          ))}
        </div>

        {/* Tournament Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-card border border-border p-6 space-y-4 animate-pulse">
              <div className="flex justify-between">
                <div className="w-20 h-5 rounded-full bg-muted" />
                <div className="w-16 h-5 rounded bg-muted" />
              </div>
              <div className="w-48 h-6 rounded-xl bg-muted" />
              <div className="w-32 h-4 rounded bg-muted" />
              <div className="pt-4 border-t border-border flex justify-between items-center">
                <div className="w-24 h-4 rounded bg-muted" />
                <div className="w-20 h-8 rounded-xl bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
