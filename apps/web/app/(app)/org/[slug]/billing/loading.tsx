export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-7 w-24 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-64 rounded bg-slate-100 animate-pulse" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
          <div className="h-7 w-20 rounded-full bg-slate-200 animate-pulse" />
        </div>
        <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="h-3 w-12 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-20 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
