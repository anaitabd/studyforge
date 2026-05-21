export default function GenerateLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <div className="h-7 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-64 rounded bg-slate-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-5 w-28 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
