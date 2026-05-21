export default function ExamLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-5 w-48 rounded bg-slate-200 animate-pulse" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
          <div className="h-6 w-16 rounded-full bg-slate-100 animate-pulse" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-slate-200 animate-pulse" />
        </div>

        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-11 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="h-9 w-24 rounded-lg bg-slate-200 animate-pulse" />
        <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-slate-200 animate-pulse" />
      </div>
    </div>
  );
}
