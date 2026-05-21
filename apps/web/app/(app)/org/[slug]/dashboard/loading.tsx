export default function OrgDashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="h-7 w-32 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-72 rounded bg-slate-100 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="h-8 w-8 rounded-xl bg-slate-200 animate-pulse" />
            <div className="h-6 w-16 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="p-5 border-b border-slate-100">
          <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="h-5 w-12 rounded-full bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
