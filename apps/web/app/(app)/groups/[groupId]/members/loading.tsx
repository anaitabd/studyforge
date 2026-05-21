export default function MembersLoading() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
        <div className="h-9 w-36 rounded-lg bg-slate-200 animate-pulse" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-slate-100 animate-pulse" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
