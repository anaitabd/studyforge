export default function OrgMembersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 rounded bg-slate-200 animate-pulse" />
        <div className="h-9 w-36 rounded-lg bg-slate-200 animate-pulse" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
