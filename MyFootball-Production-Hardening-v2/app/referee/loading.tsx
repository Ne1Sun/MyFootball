export default function RefereeLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <div className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
          <div className="w-36 h-5 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="w-20 h-8 rounded-xl bg-muted animate-pulse" />
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Stopwatch & Match State Skeleton */}
        <div className="h-64 rounded-3xl bg-card border border-border p-8 flex flex-col items-center justify-center gap-4 animate-pulse">
          <div className="w-32 h-14 rounded-2xl bg-muted" />
          <div className="w-48 h-6 rounded-full bg-muted" />
          <div className="flex gap-3">
            <div className="w-28 h-10 rounded-xl bg-muted" />
            <div className="w-28 h-10 rounded-xl bg-muted" />
          </div>
        </div>

        {/* Quick Action Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((b) => (
            <div key={b} className="h-20 rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  );
}
